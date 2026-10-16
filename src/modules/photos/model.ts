import {
  model,
  models,
  Schema,
  type InferSchemaType,
  type Model,
} from "mongoose";

const photoSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding" },
    eventId: {
      type: Schema.Types.ObjectId,
      default: null,
      ref: "WeddingEvent",
    },
    objectKey: { type: String, required: true },
    uploadKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "READY", "DELETED"],
      required: true,
      default: "PENDING",
    },
    expiresAt: { type: Date, required: true },
    originalFilename: { type: String, required: true, maxlength: 200 },
    mimeType: {
      type: String,
      enum: ["image/jpeg", "image/png", "image/webp"],
      required: true,
    },
    sizeBytes: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
    uploaderType: { type: String, enum: ["MEMBER", "GUEST"], required: true },
    uploadedByMembershipId: {
      type: Schema.Types.ObjectId,
      ref: "WeddingMembership",
    },
  },
  { timestamps: true, collection: "photos" },
);
photoSchema.index({ objectKey: 1 }, { unique: true });
photoSchema.index({ uploadKey: 1 }, { unique: true });
photoSchema.index({ weddingId: 1, status: 1, createdAt: -1, _id: -1 });
photoSchema.index({
  weddingId: 1,
  status: 1,
  eventId: 1,
  createdAt: -1,
  _id: -1,
});
export type PhotoDocument = InferSchemaType<typeof photoSchema> & {
  _id: import("mongoose").Types.ObjectId;
};
export const PhotoModel =
  (models.Photo as Model<PhotoDocument>) ||
  model<PhotoDocument>("Photo", photoSchema);
