import mongoose from "mongoose";

import { connectToDatabase } from "@/server/db/mongoose";
import { WeddingEventModel } from "@/server/models/wedding-event";
import { AppError } from "@/shared/errors";
import type { CreateEventInput, EventListQuery, UpdateEventInput } from "@/shared/events/schemas";

const OPTIONAL_EVENT_FIELDS = ["venueName", "address", "description", "dressCode"] as const;

type EventDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  type?: string;
  startsAt: Date;
  endsAt?: Date;
  venueName?: string;
  address?: string;
  description?: string;
  dressCode?: string;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeEvent(event: EventDocument) {
  return {
    id: event._id.toString(),
    name: event.name,
    type: event.type ?? null,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    venueName: event.venueName ?? null,
    address: event.address ?? null,
    description: event.description ?? null,
    dressCode: event.dressCode ?? null,
    archivedAt: event.archivedAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function normalizeOptionalFields(input: CreateEventInput | UpdateEventInput) {
  const values: Record<string, unknown> = {};
  for (const field of OPTIONAL_EVENT_FIELDS) {
    if (input[field] !== undefined && input[field] !== "") values[field] = input[field];
  }
  return values;
}

function assertEventTimes(startsAt: Date, endsAt?: Date | null) {
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new AppError("VALIDATION_ERROR", "The end time must be after the start time.", 400);
  }
}

export async function listWeddingEvents(weddingId: string, query: EventListQuery = { includeArchived: false }) {
  await connectToDatabase();
  const filter: Record<string, unknown> = { weddingId };
  if (!query.includeArchived) filter.archivedAt = null;
  if (query.from || query.to) {
    filter.startsAt = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
  }

  const events = await WeddingEventModel.find(filter).sort({ startsAt: 1, _id: 1 }).lean();
  return events.map((event) => serializeEvent(event as EventDocument));
}

export async function createWeddingEvent(weddingId: string, input: CreateEventInput) {
  await connectToDatabase();
  const startsAt = new Date(input.startsAt);
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  assertEventTimes(startsAt, endsAt);

  const event = await WeddingEventModel.create({
    weddingId,
    name: input.name,
    ...(input.type ? { type: input.type } : {}),
    startsAt,
    ...(endsAt ? { endsAt } : {}),
    ...normalizeOptionalFields(input),
  });

  return serializeEvent(event.toObject() as EventDocument);
}

export async function getWeddingEvent(weddingId: string, eventId: string) {
  if (!mongoose.isValidObjectId(eventId)) throw new AppError("NOT_FOUND", "The event could not be found.", 404);
  await connectToDatabase();
  const event = await WeddingEventModel.findOne({ _id: eventId, weddingId }).lean();
  if (!event) throw new AppError("NOT_FOUND", "The event could not be found.", 404);
  return serializeEvent(event as EventDocument);
}

export async function updateWeddingEvent(weddingId: string, eventId: string, input: UpdateEventInput) {
  if (!mongoose.isValidObjectId(eventId)) throw new AppError("NOT_FOUND", "The event could not be found.", 404);
  await connectToDatabase();
  const event = await WeddingEventModel.findOne({ _id: eventId, weddingId }).lean();
  if (!event) throw new AppError("NOT_FOUND", "The event could not be found.", 404);
  if (event.archivedAt) throw new AppError("CONFLICT", "Archived events are read-only.", 409);

  const startsAt = input.startsAt ? new Date(input.startsAt) : event.startsAt;
  const endsAt = input.endsAt === null ? null : input.endsAt ? new Date(input.endsAt) : event.endsAt ?? null;
  assertEventTimes(startsAt, endsAt);

  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.type !== undefined) set.type = input.type;
  if (input.startsAt !== undefined) set.startsAt = startsAt;
  if (input.endsAt !== undefined) {
    if (input.endsAt === null) unset.endsAt = 1;
    else set.endsAt = endsAt;
  }
  for (const field of OPTIONAL_EVENT_FIELDS) {
    if (input[field] === undefined) continue;
    if (input[field] === "") unset[field] = 1;
    else set[field] = input[field];
  }

  const update: { $set?: Record<string, unknown>; $unset?: Record<string, 1> } = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;

  const updated = await WeddingEventModel.findOneAndUpdate({ _id: eventId, weddingId, archivedAt: null }, update, {
    new: true,
    runValidators: true,
  }).lean();
  if (!updated) throw new AppError("CONFLICT", "The event changed before it could be updated. Reload and try again.", 409);
  return serializeEvent(updated as EventDocument);
}

export async function archiveWeddingEvent(weddingId: string, eventId: string) {
  if (!mongoose.isValidObjectId(eventId)) throw new AppError("NOT_FOUND", "The event could not be found.", 404);
  await connectToDatabase();
  const result = await WeddingEventModel.updateOne({ _id: eventId, weddingId, archivedAt: null }, { $set: { archivedAt: new Date() } });
  if (result.modifiedCount !== 1) throw new AppError("NOT_FOUND", "The event could not be found.", 404);
}

