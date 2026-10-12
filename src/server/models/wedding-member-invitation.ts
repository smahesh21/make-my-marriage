import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const weddingMemberInvitationSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding" },
    email: { type: String, required: true, trim: true, maxlength: 254 },
    emailNormalized: { type: String, required: true, trim: true, maxlength: 254 },
    role: { type: String, required: true, enum: ["ADMIN", "MANAGER"] },
    tokenHash: { type: String, required: true, unique: true, index: true },
    status: { type: String, required: true, enum: ["PENDING", "ACCEPTED", "REVOKED"], default: "PENDING" },
    invitedByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    acceptedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
  },
  { timestamps: true },
);

weddingMemberInvitationSchema.index({ weddingId: 1, status: 1 });
weddingMemberInvitationSchema.index({ emailNormalized: 1 });
weddingMemberInvitationSchema.index({ expiresAt: 1 });
weddingMemberInvitationSchema.index(
  { weddingId: 1, emailNormalized: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } },
);

export type WeddingMemberInvitation = InferSchemaType<typeof weddingMemberInvitationSchema>;
export const WeddingMemberInvitationModel =
  (models.WeddingMemberInvitation as Model<WeddingMemberInvitation>) ||
  model<WeddingMemberInvitation>("WeddingMemberInvitation", weddingMemberInvitationSchema);
