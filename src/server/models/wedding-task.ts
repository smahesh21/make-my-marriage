import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const weddingTaskSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding" },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    assignedMembershipId: { type: Schema.Types.ObjectId, ref: "WeddingMembership", default: null },
    eventId: { type: Schema.Types.ObjectId, ref: "WeddingEvent", default: null },
    dueDate: { type: Date, default: null },
    priority: { type: String, required: true, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
    status: { type: String, required: true, enum: ["TODO", "IN_PROGRESS", "COMPLETED"], default: "TODO" },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

weddingTaskSchema.index({ weddingId: 1, status: 1 });
weddingTaskSchema.index({ weddingId: 1, dueDate: 1 });
weddingTaskSchema.index({ weddingId: 1, assignedMembershipId: 1, status: 1 });
weddingTaskSchema.index({ weddingId: 1, eventId: 1 });

export type WeddingTask = InferSchemaType<typeof weddingTaskSchema>;
export const WeddingTaskModel =
  (models.WeddingTask as Model<WeddingTask>) || model<WeddingTask>("WeddingTask", weddingTaskSchema);
