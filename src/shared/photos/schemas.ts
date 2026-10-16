import { z } from "zod";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTO_BATCH = 20;
export const photoMimeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Choose a valid wedding event.");
export const photoUploadSchema = z
  .object({
    filename: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[^/\\\x00-\x1f\x7f]+$/, "Use a plain photo filename."),
    mimeType: photoMimeSchema,
    sizeBytes: z.number().int().min(1).max(MAX_PHOTO_BYTES),
    eventId: objectId.nullish().transform((value) => value ?? null),
  })
  .strict()
  .refine(
    (value) => {
      const extension = value.filename.split(".").pop()?.toLowerCase();
      return value.mimeType === "image/jpeg"
        ? extension === "jpg" || extension === "jpeg"
        : value.mimeType === "image/png"
          ? extension === "png"
          : extension === "webp";
    },
    {
      message: "The filename must match the selected JPEG, PNG or WebP format.",
      path: ["filename"],
    },
  );

// Extend before strict validation so confirmation accepts exactly the same metadata plus its reservation key.
export const photoConfirmationSchema = z
  .object({
    objectKey: z
      .string()
      .max(240)
      .regex(/^weddings\/[a-f\d]{24}\/uploads\/[a-f\d-]{36}\.(jpg|png|webp)$/i),
    filename: z.string(),
    mimeType: photoMimeSchema,
    sizeBytes: z.number(),
    eventId: objectId.nullish(),
  })
  .strict()
  .superRefine((value, context) => {
    const { objectKey: _key, ...metadata } = value;
    void _key;
    const result = photoUploadSchema.safeParse(metadata);
    if (!result.success)
      for (const issue of result.error.issues)
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
  })
  .transform((value) => ({ ...value, eventId: value.eventId ?? null }));

export const photoListSchema = z
  .object({
    eventId: z.union([objectId, z.literal("other")]).optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(48).default(24),
  })
  .strict();
export type PhotoUpload = z.infer<typeof photoUploadSchema>;
export type PhotoConfirmation = z.infer<typeof photoConfirmationSchema>;
export type PhotoQuery = z.infer<typeof photoListSchema>;
export type Photo = {
  id: string;
  eventId: string | null;
  url: string;
  originalFilename: string;
  mimeType: z.infer<typeof photoMimeSchema>;
  sizeBytes: number;
  uploaderType: "MEMBER" | "GUEST";
  createdAt: string;
};
export type PhotoList = {
  data: Photo[];
  total: number;
  pagination: { nextCursor: string | null };
};
