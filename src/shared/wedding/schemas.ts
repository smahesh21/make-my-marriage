import { z } from "zod";

export const dateOnlySchema = z.string().refine(
  (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  "Use a valid wedding date.",
);

export const locationSchema = z.object({
  formattedAddress: z.string().trim().max(240).optional().or(z.literal("")),
  city: z.string().trim().min(1, "Enter the wedding city or location.").max(120),
  state: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  googlePlaceId: z.string().trim().max(200).optional().or(z.literal("")),
});

export const createWeddingSchema = z.object({
  brideName: z.string().trim().min(1, "Enter the bride's name.").max(100),
  groomName: z.string().trim().min(1, "Enter the groom's name.").max(100),
  title: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  weddingDate: dateOnlySchema,
  timeZone: z.string().trim().min(1).max(80).default("Asia/Kolkata"),
  location: locationSchema,
});

export type CreateWeddingInput = z.infer<typeof createWeddingSchema>;

export const updateWeddingSchema = z
  .object({
    brideName: z.string().trim().min(1, "Enter the bride's name.").max(100).optional(),
    groomName: z.string().trim().min(1, "Enter the groom's name.").max(100).optional(),
    title: z.string().trim().max(160).optional().or(z.literal("")),
    description: z.string().trim().max(1000).optional().or(z.literal("")),
    weddingDate: dateOnlySchema.optional(),
    timeZone: z.string().trim().min(1).max(80).optional(),
    location: locationSchema.partial().optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "location" || Object.keys(value.location ?? {}).length > 0),
    "Provide at least one wedding detail to update.",
  );

export type UpdateWeddingInput = z.infer<typeof updateWeddingSchema>;
