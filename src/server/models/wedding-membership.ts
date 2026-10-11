import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding" },
    role: { type: String, required: true, enum: ["ADMIN", "MANAGER"] },
    joinedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

membershipSchema.index({ userId: 1 }, { unique: true });
membershipSchema.index({ weddingId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ weddingId: 1, role: 1 });

export type WeddingMembership = InferSchemaType<typeof membershipSchema>;
export const WeddingMembershipModel =
  (models.WeddingMembership as Model<WeddingMembership>) ||
  model<WeddingMembership>("WeddingMembership", membershipSchema);
