import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const rateLimitCounterSchema = new Schema(
  {
    keyHash: { type: String, required: true },
    windowStartedAt: { type: Date, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: "rate_limit_counters" },
);

rateLimitCounterSchema.index({ keyHash: 1, windowStartedAt: 1 }, { unique: true });
rateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitCounter = InferSchemaType<typeof rateLimitCounterSchema>;
export const RateLimitCounterModel =
  (models.RateLimitCounter as Model<RateLimitCounter>) ||
  model<RateLimitCounter>("RateLimitCounter", rateLimitCounterSchema);
