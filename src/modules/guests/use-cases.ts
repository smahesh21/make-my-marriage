import mongoose from "mongoose";

import { connectToDatabase } from "@/server/db/mongoose";
import { GuestModel, type GuestDocument } from "@/server/models/guest";
import { WeddingEventModel } from "@/server/models/wedding-event";
import { AppError } from "@/shared/errors";
import type { CreateGuestInput, GuestListQuery, UpdateGuestInput } from "@/shared/guests/schemas";
import type { Guest, GuestSummary } from "@/shared/guests/types";

type GuestRow = GuestDocument & { _id: mongoose.Types.ObjectId; __v: number; createdAt: Date; updatedAt: Date };
const missing = () => new AppError("NOT_FOUND", "The guest invitation could not be found.", 404);
const validId = (id: string) => /^[a-f\d]{24}$/i.test(id);

async function serialize(weddingId: string, rows: GuestRow[]): Promise<Guest[]> {
  const ids = [...new Set(rows.flatMap((guest) => guest.invitedEventIds.map(String)))];
  const events = ids.length ? await WeddingEventModel.find({ weddingId, _id: { $in: ids } }).select("name startsAt archivedAt").lean() : [];
  const byId = new Map(events.map((event) => [String(event._id), event]));
  return rows.map((guest) => ({
    id: String(guest._id), name: guest.name, email: guest.email || null, phone: guest.phone || null,
    maxGuests: guest.maxGuests, notes: guest.notes || null,
    invitedEventIds: guest.invitedEventIds.map(String),
    invitedEvents: guest.invitedEventIds.map((id) => {
      const event = byId.get(String(id));
      return { id: String(id), name: event?.name ?? "Unavailable event", startsAt: event?.startsAt.toISOString() ?? null, archivedAt: event?.archivedAt?.toISOString() ?? null, unavailable: !event };
    }),
    rsvpStatus: guest.rsvpStatus, attendingCount: guest.attendingCount ?? null,
    invitationSentAt: guest.invitationSentAt?.toISOString() ?? null,
    lastReminderSentAt: guest.lastReminderSentAt?.toISOString() ?? null,
    reminderCount: guest.reminderCount,
    rsvpUpdatedAt: guest.rsvpUpdatedAt?.toISOString() ?? null,
    createdAt: guest.createdAt.toISOString(), updatedAt: guest.updatedAt.toISOString(),
  }));
}

async function assertEvents(weddingId: string, ids: string[], existing: string[] = []) {
  const newIds = ids.filter((id) => !existing.includes(id));
  if (!newIds.length) return;
  const count = await WeddingEventModel.countDocuments({ weddingId, _id: { $in: newIds }, archivedAt: null });
  if (count !== newIds.length) throw new AppError("NOT_FOUND", "A selected event is unavailable. Choose active events from this wedding.", 404);
}

export async function listGuests(weddingId: string, query: GuestListQuery) {
  await connectToDatabase();
  const filter: Record<string, unknown> = { weddingId };
  if (query.rsvpStatus) filter.rsvpStatus = query.rsvpStatus;
  if (query.eventId) filter.invitedEventIds = query.eventId;
  if (query.invitationSent !== undefined) filter.invitationSentAt = query.invitationSent ? { $ne: null } : null;
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["name", "email", "phone"].map((field) => ({ [field]: { $regex: escaped, $options: "i" } }));
  }
  const [total, rows] = await Promise.all([
    GuestModel.countDocuments(filter),
    GuestModel.find(filter).sort({ name: 1, _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
  ]);
  return { data: await serialize(weddingId, rows as GuestRow[]), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function getGuest(weddingId: string, guestId: string) {
  if (!validId(guestId)) throw missing();
  await connectToDatabase();
  const row = await GuestModel.findOne({ _id: guestId, weddingId }).lean();
  if (!row) throw missing();
  return (await serialize(weddingId, [row as GuestRow]))[0]!;
}

export async function createGuest(weddingId: string, input: CreateGuestInput) {
  await connectToDatabase();
  await assertEvents(weddingId, input.invitedEventIds);
  const row = await GuestModel.create({ ...input, weddingId, emailNormalized: input.email?.toLowerCase() || undefined });
  return (await serialize(weddingId, [row.toObject() as GuestRow]))[0]!;
}

export async function updateGuest(weddingId: string, guestId: string, input: UpdateGuestInput) {
  if (!validId(guestId)) throw missing();
  await connectToDatabase();
  const row = await GuestModel.findOne({ _id: guestId, weddingId }).lean();
  if (!row) throw missing();
  if (input.maxGuests !== undefined && input.maxGuests < (row.attendingCount ?? 0)) {
    throw new AppError("PARTY_SIZE_TOO_SMALL", "Party size cannot be less than the already confirmed attendance.", 400);
  }
  if (input.invitedEventIds) await assertEvents(weddingId, input.invitedEventIds, row.invitedEventIds.map(String));
  const set: Record<string, unknown> = { ...input };
  if (input.email !== undefined) set.emailNormalized = input.email.toLowerCase();
  if (input.email !== undefined && input.email.toLowerCase() !== (row.email ?? "").toLowerCase()) {
    set.invitationSentAt = null; set.lastReminderSentAt = null; set.reminderCount = 0;
    set.invitationDeliveryKey = null; set.reminderDeliveryKey = null;
  }
  // RSVP writers also increment __v. The capacity condition remains
  // atomic so a simultaneous response cannot be overwritten by a smaller cap.
  const updated = await GuestModel.findOneAndUpdate({
    _id: guestId, weddingId, __v: row.__v,
    ...(input.maxGuests === undefined ? {} : { $or: [{ attendingCount: null }, { attendingCount: { $lte: input.maxGuests } }] }),
  }, { $set: set, $inc: { __v: 1 } }, { returnDocument: "after", runValidators: true }).lean();
  if (!updated) throw new AppError("CONFLICT", "This invitation changed. Review the latest guest details before trying again.", 409);
  return (await serialize(weddingId, [updated as GuestRow]))[0]!;
}

export async function deleteGuest(weddingId: string, guestId: string) {
  if (!validId(guestId)) throw missing();
  await connectToDatabase();
  const result = await GuestModel.deleteOne({ _id: guestId, weddingId });
  if (result.deletedCount !== 1) throw missing();
  // Guest EmailJobs do not exist in this increment; cancellation belongs with
  // the delivery increment before any such jobs may be created.
}

export async function getGuestSummary(weddingId: string): Promise<GuestSummary> {
  await connectToDatabase();
  const [summary] = await GuestModel.aggregate<GuestSummary>([
    { $match: { weddingId: new mongoose.Types.ObjectId(weddingId) } },
    { $group: { _id: null, totalGuests: { $sum: 1 }, totalGuestCapacity: { $sum: "$maxGuests" },
      pendingInvitations: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "PENDING"] }, 1, 0] } },
      attendingInvitations: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "ATTENDING"] }, 1, 0] } },
      notAttendingInvitations: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "NOT_ATTENDING"] }, 1, 0] } },
      totalPeopleAttending: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "ATTENDING"] }, "$attendingCount", 0] } },
    } }, { $project: { _id: 0 } },
  ]);
  return summary ?? { totalGuests: 0, totalGuestCapacity: 0, pendingInvitations: 0, attendingInvitations: 0, notAttendingInvitations: 0, totalPeopleAttending: 0 };
}
