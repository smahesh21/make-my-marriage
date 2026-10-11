import mongoose from "mongoose";

import { AppError } from "@/shared/errors";
import { normalizeEmail, type ForgotPasswordInput, type LoginInput, type ResetPasswordInput, type SignupInput } from "@/shared/auth/schemas";
import { connectToDatabase } from "@/server/db/mongoose";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { UserModel } from "@/server/models/user";
import { PasswordResetTokenModel } from "@/server/models/password-reset-token";
import { SessionModel } from "@/server/models/session";
import { assertEmailDeliveryConfigured, sendEmailThroughResend } from "@/server/email/resend";
import { getRequiredEnv } from "@/server/config/env";
import { createHmac, randomBytes } from "node:crypto";

export async function signup(input: SignupInput) {
  await connectToDatabase();
  const emailNormalized = normalizeEmail(input.email);
  const existingUser = await UserModel.exists({ emailNormalized });

  if (existingUser) {
    throw new AppError("EMAIL_ALREADY_EXISTS", "An account with that email already exists.", 409);
  }

  try {
    const user = await UserModel.create({
      name: input.name.trim(),
      email: input.email.trim(),
      emailNormalized,
      passwordHash: await hashPassword(input.password),
    });

    return { id: user._id.toString(), name: user.name, email: user.email };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError("EMAIL_ALREADY_EXISTS", "An account with that email already exists.", 409);
    }
    throw error;
  }
}

export async function login(input: LoginInput) {
  await connectToDatabase();
  const user = await UserModel.findOne({ emailNormalized: normalizeEmail(input.email) });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
  }

  return { id: user._id.toString(), name: user.name, email: user.email };
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  assertEmailDeliveryConfigured();
  await connectToDatabase();

  const emailNormalized = normalizeEmail(input.email);
  const user = await UserModel.findOne({ emailNormalized }).lean();
  if (!user) return;

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await PasswordResetTokenModel.deleteMany({ userId: user._id, usedAt: null });
  const resetToken = await PasswordResetTokenModel.create({
    userId: user._id,
    tokenHash: hashPasswordResetToken(rawToken),
    expiresAt,
  });

  const resetUrl = new URL(`/reset-password?token=${encodeURIComponent(rawToken)}`, getRequiredEnv("NEXT_PUBLIC_APP_URL")).toString();
  try {
    await sendEmailThroughResend({
      to: user.email,
      subject: "Reset your Make My Marriage password",
      html: `<p>We received a request to reset your Make My Marriage password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes and can be used once.</p><p>If you did not request this, you can safely ignore this email.</p>`,
      text: `Reset your Make My Marriage password: ${resetUrl}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, you can safely ignore this email.`,
    });
  } catch (error) {
    await PasswordResetTokenModel.deleteOne({ _id: resetToken._id });
    throw error;
  }
}

export async function resetPassword(input: ResetPasswordInput) {
  await connectToDatabase();
  const session = await mongoose.startSession();
  const now = new Date();

  try {
    await session.withTransaction(async () => {
      const resetToken = await PasswordResetTokenModel.findOne({ tokenHash: hashPasswordResetToken(input.token) })
        .session(session)
        .lean();

      if (!resetToken || resetToken.usedAt) {
        throw new AppError("INVALID_TOKEN", "This password reset link is invalid.", 400);
      }
      if (resetToken.expiresAt <= now) {
        throw new AppError("TOKEN_EXPIRED", "This password reset link has expired.", 400);
      }

      const claim = await PasswordResetTokenModel.updateOne(
        { _id: resetToken._id, usedAt: null },
        { $set: { usedAt: now } },
        { session },
      );
      if (claim.modifiedCount !== 1) {
        throw new AppError("INVALID_TOKEN", "This password reset link is invalid.", 400);
      }

      const userUpdate = await UserModel.updateOne(
        { _id: resetToken.userId },
        { $set: { passwordHash: await hashPassword(input.password) } },
        { session },
      );
      if (userUpdate.modifiedCount !== 1) {
        throw new AppError("INVALID_TOKEN", "This password reset link is invalid.", 400);
      }

      await SessionModel.deleteMany({ userId: resetToken.userId }, { session });
    });
  } finally {
    await session.endSession();
  }
}

function hashPasswordResetToken(token: string) {
  return createHmac("sha256", getRequiredEnv("SESSION_SECRET")).update(token).digest("hex");
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
