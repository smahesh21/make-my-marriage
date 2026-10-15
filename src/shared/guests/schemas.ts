import { z } from "zod";

export const guestStatusSchema = z.enum(["PENDING", "ATTENDING", "NOT_ATTENDING"]);
export type GuestStatus = z.infer<typeof guestStatusSchema>;
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Choose a valid wedding event.").transform((value) => value.toLowerCase());
const fields = {
  name: z.string().trim().min(1, "Enter a guest or group name.").max(120),
  email: z.string().trim().max(254).refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address."),
  phone: z.string().trim().max(40).regex(/^[\d\s+().-]*$/, "Use digits and common phone punctuation."),
  maxGuests: z.number().int("Use a whole number.").min(1).max(10000),
  invitedEventIds: z.array(objectId).max(100).refine((ids) => new Set(ids).size === ids.length, "Select each event only once."),
  notes: z.string().trim().max(2000),
};

export const createGuestSchema = z.object({
  ...fields,
  email: fields.email.optional(),
  phone: fields.phone.optional(),
  maxGuests: fields.maxGuests.default(1),
  invitedEventIds: fields.invitedEventIds.default([]),
  notes: fields.notes.optional(),
}).strict();

export const updateGuestSchema = z.object(fields).partial().strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one guest detail to update.");

export const guestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  rsvpStatus: guestStatusSchema.optional(),
  eventId: objectId.optional(),
  invitationSent: z.enum(["true", "false"]).optional().transform((value) => value === undefined ? undefined : value === "true"),
}).strict();

export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type GuestListQuery = z.infer<typeof guestListQuerySchema>;
