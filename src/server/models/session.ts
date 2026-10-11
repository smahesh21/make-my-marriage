import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
  lastUsedAt: { type: Date },
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type Session = InferSchemaType<typeof sessionSchema>;
export const SessionModel = (models.Session as Model<Session>) || model<Session>("Session", sessionSchema);
