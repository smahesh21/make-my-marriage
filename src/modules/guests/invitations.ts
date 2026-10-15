import { createHmac } from "node:crypto";

import { getRequiredEnv } from "@/server/config/env";
import { connectToDatabase } from "@/server/db/mongoose";
import {
  assertEmailDeliveryConfigured,
  sendEmailThroughResend,
} from "@/server/email/resend";
import { GuestModel } from "@/server/models/guest";
import { WeddingModel } from "@/server/models/wedding";
import { WeddingEventModel } from "@/server/models/wedding-event";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { AppError } from "@/shared/errors";
import {
  invitationTokenSchema,
  type PublicInvitation,
  type RsvpInput,
} from "@/shared/guests/invitations";

const unavailable = () =>
  new AppError(
    "NOT_FOUND",
    "This invitation is unavailable. Please contact the wedding organiser.",
    404,
  );

function sharingUrl(token: string) {
  let origin: URL;
  try {
    origin = new URL(getRequiredEnv("NEXT_PUBLIC_APP_URL"));
  } catch {
    throw new AppError(
      "SERVER_NOT_CONFIGURED",
      "The application sharing address is not configured correctly.",
      503,
    );
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password
  )
    throw new AppError(
      "SERVER_NOT_CONFIGURED",
      "The application sharing address is not configured correctly.",
      503,
    );
  return new URL(`/invite/${token}`, origin.origin).toString();
}

export async function getInvitationLink(weddingId: string, guestId: string) {
  if (!/^[a-f\d]{24}$/i.test(guestId)) throw unavailable();
  await connectToDatabase();
  const guest = await GuestModel.findOne({ _id: guestId, weddingId })
    .select("+invitationToken")
    .lean();
  if (
    !guest ||
    !(await WeddingModel.exists({ _id: weddingId, deletedAt: null }))
  )
    throw unavailable();
  return { url: sharingUrl(guest.invitationToken) };
}

async function resolve(token: string) {
  if (!invitationTokenSchema.safeParse(token).success) throw unavailable();
  await connectToDatabase();
  const guest = await GuestModel.findOne({ invitationToken: token })
    .select(
      "_id weddingId name maxGuests invitedEventIds rsvpStatus attendingCount rsvpUpdatedAt __v",
    )
    .lean();
  if (!guest) throw unavailable();
  const wedding = await WeddingModel.findOne({
    _id: guest.weddingId,
    deletedAt: null,
  })
    .select(
      "brideName groomName weddingDate timeZone title location.formattedAddress location.city location.state location.country website.welcomeMessage",
    )
    .lean();
  if (!wedding) throw unavailable();
  return { guest, wedding };
}

export async function getPublicInvitation(
  token: string,
): Promise<PublicInvitation> {
  const { guest, wedding } = await resolve(token);
  const events = await WeddingEventModel.find({
    weddingId: guest.weddingId,
    _id: { $in: guest.invitedEventIds },
    archivedAt: null,
  })
    .select("name startsAt endsAt venueName address dressCode description")
    .sort({ startsAt: 1, _id: 1 })
    .lean();
  return {
    guest: {
      name: guest.name,
      maxGuests: guest.maxGuests,
      rsvpStatus: guest.rsvpStatus,
      attendingCount: guest.attendingCount ?? null,
    },
    wedding: {
      brideName: wedding.brideName,
      groomName: wedding.groomName,
      weddingDate: wedding.weddingDate,
      timeZone: wedding.timeZone,
      title: wedding.title ?? null,
      location:
        wedding.location.formattedAddress ||
        [
          wedding.location.city,
          wedding.location.state,
          wedding.location.country,
        ]
          .filter(Boolean)
          .join(", "),
      welcomeMessage: wedding.website?.welcomeMessage || null,
    },
    events: events.map((event) => ({
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      venueName: event.venueName || null,
      address: event.address || null,
      dressCode: event.dressCode || null,
      description: event.description || null,
    })),
  };
}

export async function submitRsvp(
  token: string,
  input: RsvpInput,
  request: Request,
) {
  const { guest } = await resolve(token);
  if (input.status === "ATTENDING" && input.attendingCount > guest.maxGuests) {
    throw new AppError(
      "PARTY_SIZE_CHANGED",
      "Your invitation allows fewer people than selected. Review the current party limit and try again.",
      400,
    );
  }
  // Admit the individual invitation first, so rejected/invalid tokens cannot
  // exhaust the global quota. enforceRateLimit stores only HMAC-derived keys.
  await enforceRateLimit(request, {
    name: "guest-rsvp",
    identifier: token,
    limit: 20,
    windowMs: 15 * 60_000,
  });
  await enforceRateLimit(request, {
    name: "guest-rsvp-global",
    identifier: "all",
    limit: 300,
    windowMs: 60_000,
  });
  if (
    guest.rsvpStatus === input.status &&
    guest.attendingCount === input.attendingCount
  ) {
    return {
      status: guest.rsvpStatus,
      attendingCount: guest.attendingCount,
      updatedAt: guest.rsvpUpdatedAt?.toISOString() ?? null,
    };
  }
  const updated = await GuestModel.findOneAndUpdate(
    {
      _id: guest._id,
      weddingId: guest.weddingId,
      invitationToken: token,
      __v: guest.__v,
      maxGuests: { $gte: input.attendingCount },
    },
    {
      $set: {
        rsvpStatus: input.status,
        attendingCount: input.attendingCount,
        rsvpUpdatedAt: new Date(),
      },
      $inc: { __v: 1 },
    },
    { returnDocument: "after", runValidators: true },
  )
    .select("rsvpStatus attendingCount rsvpUpdatedAt")
    .lean();
  if (!updated)
    throw new AppError(
      "CONFLICT",
      "This invitation changed while you were replying. Review the latest details before trying again.",
      409,
    );
  return {
    status: updated.rsvpStatus,
    attendingCount: updated.attendingCount,
    updatedAt: updated.rsvpUpdatedAt?.toISOString() ?? null,
  };
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export async function sendGuestInvitation(
  weddingId: string,
  guestId: string,
  kind: "invitation" | "reminder",
  request: Request,
) {
  if (!/^[a-f\d]{24}$/i.test(guestId)) throw unavailable();
  await connectToDatabase();
  const guest = await GuestModel.findOne({ _id: guestId, weddingId })
    .select("+invitationToken")
    .lean();
  const wedding = await WeddingModel.findOne({
    _id: weddingId,
    deletedAt: null,
  })
    .select("brideName groomName weddingDate")
    .lean();
  if (!guest || !wedding) throw unavailable();
  if (!guest.email)
    throw new AppError(
      "EMAIL_REQUIRED",
      "Add an email address to send an invitation, or copy the invitation link to share it yourself.",
      400,
    );
  if (kind === "reminder" && guest.rsvpStatus !== "PENDING")
    throw new AppError(
      "RSVP_ALREADY_RECEIVED",
      "This group has already responded. Reminders are only available for pending RSVPs.",
      409,
    );
  assertEmailDeliveryConfigured();
  const url = sharingUrl(guest.invitationToken);
  await enforceRateLimit(request, {
    name: "guest-email",
    identifier: `${weddingId}:${guestId}`,
    limit: 3,
    windowMs: 15 * 60_000,
  });
  await enforceRateLimit(request, {
    name: "guest-email-wedding",
    identifier: weddingId,
    limit: 60,
    windowMs: 60 * 60_000,
  });
  // Overlapping clicks/retries within a minute use the same provider key. It
  // contains no recipient/token data and is never returned to browser code.
  const key = createHmac("sha256", getRequiredEnv("SESSION_SECRET"))
    .update(
      `${kind}:${weddingId}:${guestId}:${guest.email}:${Math.floor(Date.now() / 60_000)}`,
    )
    .digest("hex");
  const couple = `${wedding.brideName} & ${wedding.groomName}`;
  const date = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${wedding.weddingDate}T00:00:00Z`));
  const introduction =
    kind === "reminder"
      ? "A warm reminder to let us know whether your group can join us."
      : "We would love for you to celebrate our wedding with us.";
  await sendEmailThroughResend(
    {
      to: guest.email,
      subject:
        kind === "reminder"
          ? `A reminder to RSVP — ${couple}`
          : `You're invited — ${couple}`,
      html: `<div style="background:#FBF9F4;color:#1B1C19;padding:32px;font-family:Arial,sans-serif"><p>Make My Marriage</p><h1>${escapeHtml(couple)}</h1><p>Dear ${escapeHtml(guest.name)},</p><p>${escapeHtml(introduction)}</p><p>${escapeHtml(date)}</p><p><a href="${escapeHtml(url)}" style="background:#75836D;color:white;padding:8px 16px;border-radius:6px;display:inline-block">View invitation &amp; RSVP</a></p><p>No account is needed. You can revisit the same private link to change your response.</p><p>Please share this link only with your invitation group.</p></div>`,
      text: `${couple}\nDear ${guest.name},\n${introduction}\n${date}\nView invitation & RSVP: ${url}\nNo account is needed. Use the same private link to change your response. Share it only with your invitation group.`,
      idempotencyKey: `guest-${key}`,
    },
    "We couldn't send this guest email. Please try again later.",
  );
  const keyField =
    kind === "reminder" ? "reminderDeliveryKey" : "invitationDeliveryKey";
  const dateField =
    kind === "reminder" ? "lastReminderSentAt" : "invitationSentAt";
  const saved = await GuestModel.updateOne(
    { _id: guest._id, weddingId, email: guest.email, [keyField]: { $ne: key } },
    {
      $set: { [dateField]: new Date(), [keyField]: key },
      $inc: { __v: 1, ...(kind === "reminder" ? { reminderCount: 1 } : {}) },
    },
  );
  if (
    !saved.matchedCount &&
    !(await GuestModel.exists({
      _id: guest._id,
      weddingId,
      email: guest.email,
      [keyField]: key,
    }))
  ) {
    throw new AppError(
      "EMAIL_SENT_STATE_CHANGED",
      "The email was accepted for sending, but the guest details changed. Refresh the record before sending another email.",
      409,
    );
  }
}
