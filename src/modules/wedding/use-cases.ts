import { randomBytes } from "node:crypto";

import mongoose from "mongoose";

import { AppError } from "@/shared/errors";
import { type CreateWeddingInput, type UpdateWeddingInput } from "@/shared/wedding/schemas";
import { slugify } from "@/shared/wedding/slug";
import { connectToDatabase } from "@/server/db/mongoose";
import { WeddingMembershipModel } from "@/server/models/wedding-membership";
import { WeddingModel } from "@/server/models/wedding";

export async function createWeddingForUser(userId: string, input: CreateWeddingInput) {
  await connectToDatabase();
  const existingMembership = await WeddingMembershipModel.exists({ userId });

  if (existingMembership) {
    throw new AppError("ALREADY_HAS_WEDDING", "Your account already belongs to a wedding workspace.", 409);
  }

  const session = await mongoose.startSession();
  try {
    let createdWedding: {
      id: string;
      brideName: string;
      groomName: string;
      weddingDate: string;
      website: { slug: string };
    } | null = null;

    await session.withTransaction(async () => {
      const slug = await findAvailableSlug(input, session);
      const galleryToken = randomBytes(32).toString("base64url");
      const [wedding] = await WeddingModel.create(
        [
          {
            brideName: input.brideName.trim(),
            groomName: input.groomName.trim(),
            title: input.title || `${input.brideName.trim()} & ${input.groomName.trim()}`,
            description: input.description || undefined,
            weddingDate: input.weddingDate,
            timeZone: input.timeZone,
            location: input.location,
            website: {
              slug,
              theme: "classic-indian",
              isPublished: false,
            },
            gallery: {
              token: galleryToken,
              isEnabled: false,
              guestUploadsEnabled: false,
            },
            livestream: {
              isEnabled: false,
            },
            createdByUserId: userId,
          },
        ],
        { session },
      );

      if (!wedding) throw new Error("Wedding creation did not return a document.");

      await WeddingMembershipModel.create(
        [
          {
            userId,
            weddingId: wedding._id,
            role: "ADMIN",
          },
        ],
        { session },
      );

      createdWedding = {
        id: wedding._id.toString(),
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        weddingDate: wedding.weddingDate,
        website: { slug },
      };
    });

    if (!createdWedding) throw new Error("Wedding transaction did not return a wedding.");
    return createdWedding;
  } catch (error) {
    if (isDuplicateMembershipError(error)) {
      throw new AppError("ALREADY_HAS_WEDDING", "Your account already belongs to a wedding workspace.", 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function updateWeddingForMember(weddingId: string, input: UpdateWeddingInput) {
  await connectToDatabase();

  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};

  for (const field of ["brideName", "groomName", "weddingDate", "timeZone"] as const) {
    if (input[field] !== undefined) set[field] = input[field];
  }

  for (const field of ["title", "description"] as const) {
    if (input[field] === undefined) continue;
    if (input[field] === "") unset[field] = 1;
    else set[field] = input[field];
  }

  if (input.location) {
    for (const [field, value] of Object.entries(input.location)) {
      const path = `location.${field}`;
      if (value === undefined) continue;
      if (value === "") unset[path] = 1;
      else set[path] = value;
    }
  }

  const update: { $set?: Record<string, unknown>; $unset?: Record<string, 1> } = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;

  const wedding = await WeddingModel.findOneAndUpdate(
    { _id: weddingId, deletedAt: null },
    update,
    { new: true, runValidators: true },
  ).lean();

  if (!wedding) throw new AppError("WEDDING_NOT_FOUND", "The wedding workspace could not be found.", 404);

  const website = wedding.website ?? { slug: "", theme: "classic-indian", isPublished: false };
  const gallery = wedding.gallery ?? { isEnabled: false, guestUploadsEnabled: false };
  const livestream = wedding.livestream ?? { isEnabled: false };

  return {
    id: wedding._id.toString(),
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    ...(wedding.title ? { title: wedding.title } : {}),
    ...(wedding.description ? { description: wedding.description } : {}),
    weddingDate: wedding.weddingDate,
    timeZone: wedding.timeZone,
    location: {
      city: wedding.location.city,
      ...(wedding.location.formattedAddress ? { formattedAddress: wedding.location.formattedAddress } : {}),
      ...(wedding.location.state ? { state: wedding.location.state } : {}),
      ...(wedding.location.country ? { country: wedding.location.country } : {}),
    },
    website: {
      slug: website.slug,
      theme: website.theme,
      isPublished: website.isPublished,
      ...(website.welcomeMessage ? { welcomeMessage: website.welcomeMessage } : {}),
    },
    gallery: {
      isEnabled: gallery.isEnabled,
      guestUploadsEnabled: gallery.guestUploadsEnabled,
    },
    livestream: {
      ...(livestream.youtubeUrl ? { youtubeUrl: livestream.youtubeUrl } : {}),
      isEnabled: livestream.isEnabled,
    },
  };
}

function isDuplicateMembershipError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) return false;
  const duplicateFields = "keyPattern" in error ? error.keyPattern : "keyValue" in error ? error.keyValue : null;
  return typeof duplicateFields === "object" && duplicateFields !== null && "userId" in duplicateFields;
}

async function findAvailableSlug(input: CreateWeddingInput, session: mongoose.ClientSession) {
  const base = slugify(`${input.brideName}-${input.groomName}-${input.weddingDate}`);
  let candidate = base;

  for (let suffix = 2; suffix <= 20; suffix += 1) {
    const exists = await WeddingModel.exists({ "website.slug": candidate }).session(session);
    if (!exists) return candidate;
    candidate = `${base}-${suffix}`;
  }

  return `${base}-${randomBytes(3).toString("hex")}`;
}

