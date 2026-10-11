import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const passwordResetTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
  createdAt: { type: Date, required: true, default: Date.now },
});

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetToken = InferSchemaType<typeof passwordResetTokenSchema>;
export const PasswordResetTokenModel =
  (models.PasswordResetToken as Model<PasswordResetToken>) ||
  model<PasswordResetToken>("PasswordResetToken", passwordResetTokenSchema);
