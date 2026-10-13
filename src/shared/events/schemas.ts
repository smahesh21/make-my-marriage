import { z } from "zod";

export const eventTypeSchema = z.enum([
  "ROKA",
  "ENGAGEMENT",
  "MEHENDI",
  "HALDI",
  "SANGEET",
  "COCKTAIL",
  "WEDDING",
  "RECEPTION",
  "CUSTOM",
]);

export type EventType = z.infer<typeof eventTypeSchema>;

const isoDateTimeWithOffsetSchema = z.string().refine(
  (value) => {
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return false;
    return !Number.isNaN(Date.parse(value));
  },
  "Use a valid date and time with an explicit timezone offset.",
);

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const createEventSchema = z
  .object({
    name: z.string().trim().min(1, "Enter an event name.").max(160),
    type: eventTypeSchema.optional(),
    startsAt: isoDateTimeWithOffsetSchema,
    endsAt: isoDateTimeWithOffsetSchema.optional().nullable(),
    venueName: optionalText(160),
    address: optionalText(240),
    description: optionalText(1000),
    dressCode: optionalText(160),
  })
  .strict()
  .refine(
    (value) => value.endsAt === undefined || value.endsAt === null || new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(),
    { message: "The end time must be after the start time.", path: ["endsAt"] },
  );

export const updateEventSchema = z
  .object({
    name: z.string().trim().min(1, "Enter an event name.").max(160).optional(),
    type: eventTypeSchema.optional(),
    startsAt: isoDateTimeWithOffsetSchema.optional(),
    endsAt: isoDateTimeWithOffsetSchema.optional().nullable(),
    venueName: optionalText(160),
    address: optionalText(240),
    description: optionalText(1000),
    dressCode: optionalText(160),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one event detail to update.");

export const eventListQuerySchema = z.object({
  includeArchived: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  from: isoDateTimeWithOffsetSchema.optional(),
  to: isoDateTimeWithOffsetSchema.optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventListQuery = z.infer<typeof eventListQuerySchema>;

