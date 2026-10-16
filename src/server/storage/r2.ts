import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getRequiredEnv } from "@/server/config/env";
import { AppError } from "@/shared/errors";
import type { PhotoUpload } from "@/shared/photos/schemas";

function storage() {
  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${getRequiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      maxAttempts: 2,
    }),
    bucket: getRequiredEnv("R2_BUCKET_NAME"),
  };
}
export function storageError() {
  return new AppError(
    "STORAGE_UNAVAILABLE",
    "Photo storage is temporarily unavailable. Please retry.",
    503,
  );
}
export function matchesImageSignature(bytes: Uint8Array, mimeType: string) {
  const prefix = Buffer.from(bytes);
  if (mimeType === "image/jpeg")
    return (
      prefix.length >= 3 &&
      prefix[0] === 0xff &&
      prefix[1] === 0xd8 &&
      prefix[2] === 0xff
    );
  if (mimeType === "image/png")
    return (
      prefix.length >= 8 &&
      prefix
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  return (
    mimeType === "image/webp" &&
    prefix.length >= 12 &&
    prefix.toString("ascii", 0, 4) === "RIFF" &&
    prefix.toString("ascii", 8, 12) === "WEBP"
  );
}
export async function signPhotoUpload(key: string, input: PhotoUpload) {
  const { client, bucket } = storage();
  try {
    return await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: input.mimeType,
        ContentLength: input.sizeBytes,
      }),
      {
        expiresIn: 600,
        signableHeaders: new Set(["content-type", "content-length"]),
      },
    );
  } catch {
    throw storageError();
  } finally {
    client.destroy();
  }
}
export async function signPhotoRead(key: string, filename?: string) {
  const { client, bucket } = storage();
  try {
    const disposition = filename
      ? `attachment; filename="photo.${
          filename
            .split(".")
            .pop()
            ?.replace(/[^a-z0-9]/gi, "") || "jpg"
        }"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`
      : undefined;
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: disposition,
        ResponseCacheControl: "private, no-store",
      }),
      { expiresIn: 900 },
    );
  } catch {
    throw storageError();
  } finally {
    client.destroy();
  }
}
export async function publishPhotoObject(
  uploadKey: string,
  finalKey: string,
  expected: PhotoUpload,
) {
  const { client, bucket } = storage();
  const options = () => ({ abortSignal: AbortSignal.timeout(20_000) });
  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: uploadKey }),
      options(),
    );
    if (
      !head.ETag ||
      head.ContentLength !== expected.sizeBytes ||
      head.ContentType !== expected.mimeType
    )
      throw new AppError(
        "INVALID_PHOTO",
        "The uploaded photo does not match its file details. Choose the file again.",
        400,
      );
    const prefix = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: uploadKey,
        Range: "bytes=0-15",
        IfMatch: head.ETag,
      }),
      options(),
    );
    const bytes = await prefix.Body?.transformToByteArray();
    if (!bytes || !matchesImageSignature(bytes, expected.mimeType))
      throw new AppError(
        "INVALID_PHOTO",
        "This file is not a supported photo.",
        400,
      );
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: finalKey,
        CopySource: `${bucket}/${uploadKey}`,
        CopySourceIfMatch: head.ETag,
      }),
      options(),
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (
      error instanceof Error &&
      ["NotFound", "NoSuchKey"].includes(error.name)
    )
      throw new AppError(
        "UPLOAD_NOT_FOUND",
        "The upload is not available yet. Retry the upload before confirming.",
        409,
      );
    throw storageError();
  } finally {
    client.destroy();
  }
}
export async function deletePhotoObject(key: string) {
  const { client, bucket } = storage();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw storageError();
  } finally {
    client.destroy();
  }
}
