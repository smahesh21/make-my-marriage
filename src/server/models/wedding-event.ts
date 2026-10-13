import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const weddingEventSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding" },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: {
      type: String,
      enum: ["ROKA", "ENGAGEMENT", "MEHENDI", "HALDI", "SANGEET", "COCKTAIL", "WEDDING", "RECEPTION", "CUSTOM"],
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date },
    venueName: { type: String, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 240 },
    description: { type: String, trim: true, maxlength: 1000 },
    dressCode: { type: String, trim: true, maxlength: 160 },
    coverImageObjectKey: { type: String, trim: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

weddingEventSchema.index({ weddingId: 1, startsAt: 1 });
weddingEventSchema.index({ weddingId: 1, archivedAt: 1 });

export type WeddingEvent = InferSchemaType<typeof weddingEventSchema>;
export const WeddingEventModel = (models.WeddingEvent as Model<WeddingEvent>) || model<WeddingEvent>("WeddingEvent", weddingEventSchema);

