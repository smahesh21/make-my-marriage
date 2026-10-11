import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const locationSchema = new Schema(
  {
    formattedAddress: { type: String, trim: true, maxlength: 240 },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    country: { type: String, trim: true, maxlength: 120 },
    latitude: { type: Number },
    longitude: { type: Number },
    googlePlaceId: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false },
);

const weddingSchema = new Schema(
  {
    brideName: { type: String, required: true, trim: true, maxlength: 100 },
    groomName: { type: String, required: true, trim: true, maxlength: 100 },
    title: { type: String, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000 },
    weddingDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    timeZone: { type: String, required: true, default: "Asia/Kolkata" },
    coverImageObjectKey: { type: String },
    location: { type: locationSchema, required: true },
    website: {
      slug: { type: String, required: true },
      theme: { type: String, required: true, default: "classic-indian" },
      isPublished: { type: Boolean, required: true, default: false },
      welcomeMessage: { type: String },
    },
    gallery: {
      token: { type: String, required: true },
      isEnabled: { type: Boolean, required: true, default: false },
      guestUploadsEnabled: { type: Boolean, required: true, default: false },
    },
    livestream: {
      youtubeUrl: { type: String },
      isEnabled: { type: Boolean, required: true, default: false },
    },
    createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

weddingSchema.index({ "website.slug": 1 }, { unique: true });
weddingSchema.index({ "gallery.token": 1 }, { unique: true });

export type Wedding = InferSchemaType<typeof weddingSchema>;
export const WeddingModel = (models.Wedding as Model<Wedding>) || model<Wedding>("Wedding", weddingSchema);
