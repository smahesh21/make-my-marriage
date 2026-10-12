import { createHmac, randomBytes } from "node:crypto";

import mongoose from "mongoose";

import { getRequiredEnv } from "@/server/config/env";
import { connectToDatabase } from "@/server/db/mongoose";
import { assertEmailDeliveryConfigured, sendEmailThroughResend } from "@/server/email/resend";
import { UserModel } from "@/server/models/user";
import { WeddingMemberInvitationModel } from "@/server/models/wedding-member-invitation";
import { WeddingMembershipModel } from "@/server/models/wedding-membership";
import { WeddingModel } from "@/server/models/wedding";
import { AppError } from "@/shared/errors";
import { normalizeEmail } from "@/shared/auth/schemas";
import type { InviteMemberInput, MemberRole, UpdateMemberRoleInput } from "@/shared/members/schemas";

export const MEMBER_INVITATION_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

type MemberUser = {
  id: string;
  name: string;
  email: string;
};

function hashMemberInvitationToken(token: string) {
  return createHmac("sha256", getRequiredEnv("SESSION_SECRET")).update(token).digest("hex");
}

export async function listWeddingMembers(weddingId: string) {
  await connectToDatabase();
  const memberships = await WeddingMembershipModel.find({ weddingId }).sort({ joinedAt: 1, _id: 1 }).lean();
  const userIds = memberships.map((membership) => membership.userId);
  const users = await UserModel.find({ _id: { $in: userIds } }).lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  return memberships.flatMap((membership) => {
    const user = usersById.get(membership.userId.toString());
    if (!user) return [];

    return [
      {
        membershipId: membership._id.toString(),
        user: { id: user._id.toString(), name: user.name, email: user.email },
        role: membership.role as MemberRole,
        joinedAt: membership.joinedAt.toISOString(),
      },
    ];
  });
}

export async function listPendingMemberInvitations(weddingId: string) {
  await connectToDatabase();
  const invitations = await WeddingMemberInvitationModel.find({
    weddingId,
    status: "PENDING",
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();

  return invitations.map((invitation) => ({
    id: invitation._id.toString(),
    email: invitation.email,
    role: invitation.role as MemberRole,
    status: "PENDING" as const,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  }));
}

export async function inviteWeddingMember(weddingId: string, invitedByUserId: string, input: InviteMemberInput) {
  assertEmailDeliveryConfigured();
  await connectToDatabase();

  const wedding = await WeddingModel.findOne({ _id: weddingId, deletedAt: null }).lean();
  if (!wedding) throw new AppError("WEDDING_NOT_FOUND", "The wedding workspace could not be found.", 404);

  const emailNormalized = normalizeEmail(input.email);
  const existingUser = await UserModel.findOne({ emailNormalized }).lean();
  if (existingUser && (await WeddingMembershipModel.exists({ userId: existingUser._id }))) {
    throw new AppError("ALREADY_HAS_WEDDING", "This person already belongs to a wedding workspace.", 409);
  }

  const existingInvitation = await WeddingMemberInvitationModel.exists({
    weddingId,
    emailNormalized,
    status: "PENDING",
  });
  if (existingInvitation) {
    throw new AppError("INVITATION_ALREADY_PENDING", "An invitation is already pending for this email address.", 409);
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MEMBER_INVITATION_VALIDITY_MS);
  let invitation;

  try {
    invitation = await WeddingMemberInvitationModel.create({
      weddingId,
      email: input.email.trim(),
      emailNormalized,
      role: input.role,
      tokenHash: hashMemberInvitationToken(rawToken),
      status: "PENDING",
      invitedByUserId,
      expiresAt,
    });

    const invitationUrl = new URL(
      `/member-invitations/${encodeURIComponent(rawToken)}`,
      getRequiredEnv("NEXT_PUBLIC_APP_URL"),
    ).toString();
    const weddingName = `${wedding.brideName} & ${wedding.groomName}`;
    const safeWeddingName = escapeHtml(weddingName);
    const safeRole = input.role === "ADMIN" ? "Admin" : "Manager";

    await sendEmailThroughResend(
      {
        to: input.email.trim(),
        subject: `You’re invited to help plan ${weddingName}`,
        html: `<p>You’ve been invited to join <strong>${safeWeddingName}</strong> as a ${safeRole}.</p><p><a href="${escapeHtml(invitationUrl)}">Open your wedding workspace invitation</a></p><p>This invitation expires in 7 days and can only be used by ${escapeHtml(input.email.trim())}.</p>`,
        text: `You’ve been invited to join ${weddingName} as a ${safeRole}. Open your invitation: ${invitationUrl}\n\nThis invitation expires in 7 days and can only be used by ${input.email.trim()}.`,
      },
      "We couldn’t send the member invitation email. Please try again later.",
    );
  } catch (error) {
    if (invitation?._id) await WeddingMemberInvitationModel.deleteOne({ _id: invitation._id });
    if (isDuplicateKeyError(error)) {
      throw new AppError("INVITATION_ALREADY_PENDING", "An invitation is already pending for this email address.", 409);
    }
    throw error;
  }

  return {
    id: invitation._id.toString(),
    email: invitation.email,
    role: invitation.role as MemberRole,
    status: "PENDING" as const,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

export async function revokeMemberInvitation(weddingId: string, invitationId: string) {
  if (!mongoose.isValidObjectId(invitationId)) {
    throw new AppError("NOT_FOUND", "The invitation could not be found.", 404);
  }
  await connectToDatabase();
  const result = await WeddingMemberInvitationModel.updateOne(
    { _id: invitationId, weddingId, status: "PENDING" },
    { $set: { status: "REVOKED" } },
  );
  if (result.modifiedCount !== 1) {
    throw new AppError("NOT_FOUND", "The invitation could not be found.", 404);
  }
}

export async function updateMemberRole(weddingId: string, membershipId: string, input: UpdateMemberRoleInput) {
  if (!mongoose.isValidObjectId(membershipId)) {
    throw new AppError("NOT_FOUND", "The wedding member could not be found.", 404);
  }
  await connectToDatabase();
  const session = await mongoose.startSession();
  let updatedRole: MemberRole | null = null;

  try {
    await session.withTransaction(async () => {
      const membership = await WeddingMembershipModel.findOne({ _id: membershipId, weddingId }).session(session).lean();
      if (!membership) throw new AppError("NOT_FOUND", "The wedding member could not be found.", 404);

      if (membership.role === input.role) {
        updatedRole = membership.role as MemberRole;
        return;
      }

      if (membership.role === "ADMIN" && input.role === "MANAGER") {
        const adminCount = await WeddingMembershipModel.countDocuments({ weddingId, role: "ADMIN" }).session(session);
        if (adminCount <= 1) {
          throw new AppError("LAST_ADMIN", "A wedding workspace must always have at least one Admin.", 409);
        }
      }

      const result = await WeddingMembershipModel.updateOne(
        { _id: membershipId, weddingId },
        { $set: { role: input.role } },
        { session },
      );
      if (result.modifiedCount !== 1) throw new AppError("NOT_FOUND", "The wedding member could not be found.", 404);
      updatedRole = input.role;
    });
  } finally {
    await session.endSession();
  }

  return { role: updatedRole };
}

export async function removeWeddingMember(weddingId: string, membershipId: string) {
  if (!mongoose.isValidObjectId(membershipId)) {
    throw new AppError("NOT_FOUND", "The wedding member could not be found.", 404);
  }
  await connectToDatabase();
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const membership = await WeddingMembershipModel.findOne({ _id: membershipId, weddingId }).session(session).lean();
      if (!membership) throw new AppError("NOT_FOUND", "The wedding member could not be found.", 404);

      if (membership.role === "ADMIN") {
        const adminCount = await WeddingMembershipModel.countDocuments({ weddingId, role: "ADMIN" }).session(session);
        if (adminCount <= 1) {
          throw new AppError("LAST_ADMIN", "A wedding workspace must always have at least one Admin.", 409);
        }
      }

      const result = await WeddingMembershipModel.deleteOne({ _id: membershipId, weddingId }, { session });
      if (result.deletedCount !== 1) throw new AppError("NOT_FOUND", "The wedding member could not be found.", 404);
    });
  } finally {
    await session.endSession();
  }
}

export async function getPublicMemberInvitation(token: string) {
  await connectToDatabase();
  const invitation = await WeddingMemberInvitationModel.findOne({ tokenHash: hashMemberInvitationToken(token) }).lean();
  if (!invitation || invitation.status === "REVOKED") {
    throw new AppError("INVALID_TOKEN", "This member invitation is invalid.", 404);
  }
  if (invitation.status === "ACCEPTED") {
    throw new AppError("INVITATION_ALREADY_ACCEPTED", "This member invitation has already been accepted.", 409);
  }
  if (invitation.expiresAt <= new Date()) {
    throw new AppError("TOKEN_EXPIRED", "This member invitation has expired.", 410);
  }

  const wedding = await WeddingModel.findOne({ _id: invitation.weddingId, deletedAt: null })
    .select({ brideName: 1, groomName: 1, weddingDate: 1, "location.city": 1, "location.state": 1 })
    .lean();
  if (!wedding) throw new AppError("INVALID_TOKEN", "This member invitation is invalid.", 404);

  return {
    email: invitation.email,
    role: invitation.role as MemberRole,
    wedding: {
      brideName: wedding.brideName,
      groomName: wedding.groomName,
      weddingDate: wedding.weddingDate,
      location: {
        city: wedding.location.city,
        ...(wedding.location.state ? { state: wedding.location.state } : {}),
      },
    },
    requiresLogin: true,
  };
}

export async function acceptMemberInvitation(token: string, user: MemberUser) {
  await connectToDatabase();
  const session = await mongoose.startSession();
  const now = new Date();
  let acceptedRole: MemberRole | null = null;
  let weddingId: string | null = null;

  try {
    await session.withTransaction(async () => {
      const invitation = await WeddingMemberInvitationModel.findOne({ tokenHash: hashMemberInvitationToken(token) })
        .session(session)
        .lean();

      if (!invitation) throw new AppError("INVALID_TOKEN", "This member invitation is invalid.", 400);
      if (invitation.status === "ACCEPTED") {
        throw new AppError("INVITATION_ALREADY_ACCEPTED", "This member invitation has already been accepted.", 409);
      }
      if (invitation.status !== "PENDING") throw new AppError("INVALID_TOKEN", "This member invitation is invalid.", 400);
      if (invitation.expiresAt <= now) throw new AppError("TOKEN_EXPIRED", "This member invitation has expired.", 400);
      if (normalizeEmail(user.email) !== invitation.emailNormalized) {
        throw new AppError("INVITATION_EMAIL_MISMATCH", "Sign in with the invited email address to accept this invitation.", 403);
      }

      if (await WeddingMembershipModel.exists({ userId: user.id }).session(session)) {
        throw new AppError("ALREADY_HAS_WEDDING", "Your account already belongs to a wedding workspace.", 409);
      }

      try {
        await WeddingMembershipModel.create(
          [{ userId: user.id, weddingId: invitation.weddingId, role: invitation.role }],
          { session },
        );
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new AppError("ALREADY_HAS_WEDDING", "Your account already belongs to a wedding workspace.", 409);
        }
        throw error;
      }

      const claim = await WeddingMemberInvitationModel.updateOne(
        { _id: invitation._id, status: "PENDING" },
        { $set: { status: "ACCEPTED", acceptedByUserId: user.id, acceptedAt: now } },
        { session },
      );
      if (claim.modifiedCount !== 1) {
        throw new AppError("INVITATION_ALREADY_ACCEPTED", "This member invitation has already been accepted.", 409);
      }

      acceptedRole = invitation.role as MemberRole;
      weddingId = invitation.weddingId.toString();
    });
  } finally {
    await session.endSession();
  }

  return { weddingId, role: acceptedRole };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
