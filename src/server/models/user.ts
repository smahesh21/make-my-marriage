import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, maxlength: 254 },
    emailNormalized: { type: String, required: true, trim: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = (models.User as Model<User>) || model<User>("User", userSchema);
