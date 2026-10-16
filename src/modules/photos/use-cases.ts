import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/server/db/mongoose";
import { WeddingEventModel } from "@/server/models/wedding-event";
import { enforceRateLimit } from "@/server/security/rate-limit";
import {
  deletePhotoObject,
  publishPhotoObject,
  signPhotoRead,
  signPhotoUpload,
} from "@/server/storage/r2";
import { AppError } from "@/shared/errors";
import type {
  Photo,
  PhotoConfirmation,
  PhotoList,
  PhotoQuery,
  PhotoUpload,
} from "@/shared/photos/schemas";
import { PhotoModel, type PhotoDocument } from "./model";

const missing = () =>
  new AppError("NOT_FOUND", "The photo could not be found.", 404);
const extension = (mime: string) =>
  mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
async function serialize(photo: PhotoDocument): Promise<Photo> {
  return {
    id: String(photo._id),
    eventId: photo.eventId ? String(photo.eventId) : null,
    originalFilename: photo.originalFilename,
    mimeType: photo.mimeType as Photo["mimeType"],
    sizeBytes: photo.sizeBytes,
    uploaderType: photo.uploaderType as Photo["uploaderType"],
    createdAt: photo.createdAt.toISOString(),
    url: await signPhotoRead(photo.objectKey),
  };
}
export async function createPhotoUpload(
  weddingId: string,
  membershipId: string,
  input: PhotoUpload,
  request: Request,
) {
  await connectToDatabase();
  if (
    input.eventId &&
    !(await WeddingEventModel.exists({
      _id: input.eventId,
      weddingId,
      archivedAt: null,
    }))
  )
    throw new AppError(
      "INVALID_EVENT",
      "Choose an active event from this wedding.",
      400,
    );
  await enforceRateLimit(request, {
    name: "photo-upload-member",
    identifier: `${weddingId}:${membershipId}`,
    limit: 120,
    windowMs: 15 * 60_000,
  });
  await enforceRateLimit(request, {
    name: "photo-upload-wedding",
    identifier: weddingId,
    limit: 600,
    windowMs: 15 * 60_000,
  });
  const objectKey = `weddings/${weddingId}/uploads/${randomUUID()}.${extension(input.mimeType)}`;
  const uploadUrl = await signPhotoUpload(objectKey, input);
  const expiresAt = new Date(Date.now() + 600_000);
  await PhotoModel.create({
    weddingId,
    eventId: input.eventId,
    objectKey,
    uploadKey: objectKey,
    expiresAt,
    originalFilename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    status: "PENDING",
    uploaderType: "MEMBER",
    uploadedByMembershipId: membershipId,
  });
  return { uploadUrl, objectKey, expiresAt: expiresAt.toISOString() };
}
export async function confirmPhotoUpload(
  weddingId: string,
  membershipId: string,
  input: PhotoConfirmation,
) {
  await connectToDatabase();
  const filter = {
    weddingId,
    uploadKey: input.objectKey,
    uploadedByMembershipId: membershipId,
    uploaderType: "MEMBER" as const,
  };
  const photo = await PhotoModel.findOne(filter).lean();
  if (!photo || photo.status === "DELETED") throw missing();
  if (
    photo.originalFilename !== input.filename ||
    photo.mimeType !== input.mimeType ||
    photo.sizeBytes !== input.sizeBytes ||
    (photo.eventId ? String(photo.eventId) : null) !== input.eventId
  )
    throw new AppError(
      "UPLOAD_MISMATCH",
      "The photo details differ from the reserved upload.",
      400,
    );
  if (photo.status === "READY") return serialize(photo);
  if (photo.expiresAt.getTime() + 86_400_000 < Date.now())
    throw new AppError(
      "UPLOAD_EXPIRED",
      "This upload has expired. Choose the photo again.",
      409,
    );
  const finalKey = `weddings/${weddingId}/photos/${randomUUID()}.${extension(input.mimeType)}`;
  await publishPhotoObject(photo.uploadKey, finalKey, input);
  // If this write throws, retain the copied object: the DB may have committed it.
  const ready = await PhotoModel.findOneAndUpdate(
    { ...filter, status: "PENDING" },
    { $set: { status: "READY", objectKey: finalKey } },
    { returnDocument: "after" },
  ).lean();
  if (!ready) {
    await deletePhotoObject(finalKey).catch(() => undefined);
    const current = await PhotoModel.findOne(filter).lean();
    if (!current || current.status !== "READY") throw missing();
    return serialize(current);
  }
  await deletePhotoObject(photo.uploadKey).catch(() => undefined);
  return serialize(ready);
}
export async function listPhotos(
  weddingId: string,
  query: PhotoQuery,
): Promise<PhotoList> {
  await connectToDatabase();
  const base = {
    weddingId,
    status: "READY" as const,
    ...(query.eventId
      ? { eventId: query.eventId === "other" ? null : query.eventId }
      : {}),
  };
  let boundary = {};
  if (query.cursor) {
    try {
      const cursor = JSON.parse(
        Buffer.from(query.cursor, "base64url").toString("utf8"),
      );
      if (
        cursor.eventId !== (query.eventId ?? "") ||
        cursor.weddingId !== weddingId ||
        !/^[a-f\d]{24}$/i.test(cursor.id) ||
        typeof cursor.createdAt !== "string" ||
        !Number.isFinite(Date.parse(cursor.createdAt))
      )
        throw Error();
      const date = new Date(cursor.createdAt);
      boundary = {
        $or: [
          { createdAt: { $lt: date } },
          { createdAt: date, _id: { $lt: new Types.ObjectId(cursor.id) } },
        ],
      };
    } catch {
      throw new AppError(
        "INVALID_CURSOR",
        "Refresh the gallery to restart pagination.",
        400,
      );
    }
  }
  const [rows, total] = await Promise.all([
    PhotoModel.find({ ...base, ...boundary })
      .sort({ createdAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean(),
    PhotoModel.countDocuments(base),
  ]);
  const more = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    data: await Promise.all(page.map(serialize)),
    total,
    pagination: {
      nextCursor:
        more && last
          ? Buffer.from(
              JSON.stringify({
                weddingId,
                eventId: query.eventId ?? "",
                id: String(last._id),
                createdAt: last.createdAt.toISOString(),
              }),
            ).toString("base64url")
          : null,
    },
  };
}
async function findReady(weddingId: string, photoId: string) {
  if (!/^[a-f\d]{24}$/i.test(photoId)) throw missing();
  await connectToDatabase();
  const photo = await PhotoModel.findOne({
    _id: photoId,
    weddingId,
    status: "READY",
  }).lean();
  if (!photo) throw missing();
  return photo;
}
export async function downloadPhoto(weddingId: string, photoId: string) {
  const photo = await findReady(weddingId, photoId);
  return { url: await signPhotoRead(photo.objectKey, photo.originalFilename) };
}
export async function deletePhoto(weddingId: string, photoId: string) {
  const photo = await findReady(weddingId, photoId);
  await deletePhotoObject(photo.objectKey);
  await PhotoModel.updateOne(
    { _id: photo._id, weddingId, status: "READY" },
    { $set: { status: "DELETED" } },
  );
  return { success: true };
}
