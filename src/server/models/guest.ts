import { randomBytes } from "node:crypto";
import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { createGuestSchema } from "@/shared/guests/schemas";

const guestSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", immutable: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, trim: true, maxlength: 254, validate: { validator: (value: string | undefined) => createGuestSchema.shape.email.safeParse(value).success, message: "Use a valid email address." } },
  emailNormalized: { type: String, select: false },
  phone: { type: String, trim: true, maxlength: 40, match: /^[\d\s+().-]*$/ },
  maxGuests: { type: Number, required: true, default: 1, min: 1, max: 10000, validate: Number.isInteger },
  invitedEventIds: { type: [{ type: Schema.Types.ObjectId, ref: "WeddingEvent" }], default: [], validate: { validator: (ids: unknown[]) => ids.length <= 100 && new Set(ids.map(String)).size === ids.length, message: "Select at most 100 unique events." } },
  notes: { type: String, trim: true, maxlength: 2000 },
  // Deliberate stable-sharing exception: never select or serialize in CRUD.
  invitationToken: { type: String, required: true, select: false, immutable: true, default: () => randomBytes(32).toString("base64url") },
  invitationSentAt: { type: Date, default: null },
  lastReminderSentAt: { type: Date, default: null },
  reminderCount: { type: Number, default: 0, min: 0 },
  invitationDeliveryKey: { type: String, select: false },
  reminderDeliveryKey: { type: String, select: false },
  rsvpStatus: { type: String, enum: ["PENDING", "ATTENDING", "NOT_ATTENDING"], default: "PENDING", required: true },
  attendingCount: { type: Number, default: null, min: 0, max: 10000, validate: { validator: (value: number | null) => value === null || Number.isInteger(value), message: "Attendance must be a whole number." } },
  rsvpUpdatedAt: { type: Date, default: null },
}, { timestamps: true, collection: "guests" });

guestSchema.pre("validate", function () {
  const count = this.attendingCount ?? null;
  if ((this.rsvpStatus === "PENDING" && count !== null)
    || (this.rsvpStatus === "NOT_ATTENDING" && count !== 0)
    || (this.rsvpStatus === "ATTENDING" && (count === null || count < 1 || count > this.maxGuests))) {
    this.invalidate("attendingCount", "Attendance must match the RSVP status and party capacity.");
  }
});
guestSchema.index({ invitationToken: 1 }, { unique: true });
guestSchema.index({ weddingId: 1, rsvpStatus: 1 });
guestSchema.index({ weddingId: 1, name: 1, _id: 1 });
guestSchema.index({ weddingId: 1, emailNormalized: 1 });
guestSchema.index({ weddingId: 1, invitedEventIds: 1 });

export type GuestDocument = InferSchemaType<typeof guestSchema>;
export const GuestModel = (models.Guest as Model<GuestDocument>) || model<GuestDocument>("Guest", guestSchema);
