import type { GuestStatus } from "./schemas";

export type Guest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  maxGuests: number;
  invitedEventIds: string[];
  invitedEvents: { id: string; name: string; startsAt: string | null; archivedAt: string | null; unavailable: boolean }[];
  notes: string | null;
  rsvpStatus: GuestStatus;
  attendingCount: number | null;
  invitationSentAt: string | null;
  lastReminderSentAt: string | null;
  reminderCount: number;
  rsvpUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GuestSummary = {
  totalGuests: number;
  pendingInvitations: number;
  attendingInvitations: number;
  notAttendingInvitations: number;
  totalPeopleAttending: number;
  totalGuestCapacity: number;
};
export type GuestPagination = { page: number; limit: number; total: number; totalPages: number };
