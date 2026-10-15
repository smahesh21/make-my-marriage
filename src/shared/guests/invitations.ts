import { z } from "zod";
import type { GuestStatus } from "./schemas";

export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const rsvpSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ATTENDING"),
      attendingCount: z.number().int().min(1).max(10000),
    })
    .strict(),
  z
    .object({
      status: z.literal("NOT_ATTENDING"),
      attendingCount: z.literal(0),
    })
    .strict(),
]);
export type RsvpInput = z.infer<typeof rsvpSchema>;
export type PublicInvitation = {
  guest: {
    name: string;
    maxGuests: number;
    rsvpStatus: GuestStatus;
    attendingCount: number | null;
  };
  wedding: {
    brideName: string;
    groomName: string;
    weddingDate: string;
    timeZone: string;
    title: string | null;
    location: string;
    welcomeMessage: string | null;
  };
  events: {
    name: string;
    startsAt: string;
    endsAt: string | null;
    venueName: string | null;
    address: string | null;
    dressCode: string | null;
    description: string | null;
  }[];
};
