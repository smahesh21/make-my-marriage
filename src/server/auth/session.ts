import { createHash, createHmac, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { getRequiredEnv } from "@/server/config/env";
import { connectToDatabase } from "@/server/db/mongoose";
import { SessionModel } from "@/server/models/session";

export const SESSION_COOKIE_NAME = "mmm_session";
const REMEMBERED_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const SESSION_DURATION_SECONDS = 60 * 60 * 24;

function hashSessionToken(token: string) {
  return createHmac("sha256", getRequiredEnv("SESSION_SECRET")).update(token).digest("hex");
}

function cookieOptions(rememberDevice: boolean) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(rememberDevice ? { maxAge: REMEMBERED_SESSION_DURATION_SECONDS } : {}),
  };
}

export async function createSession(userId: string, rememberDevice = true) {
  await connectToDatabase();
  const token = randomBytes(32).toString("base64url");
  const durationSeconds = rememberDevice ? REMEMBERED_SESSION_DURATION_SECONDS : SESSION_DURATION_SECONDS;
  const expiresAt = new Date(Date.now() + durationSeconds * 1000);

  await SessionModel.create({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions(rememberDevice));
}

export async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function clearSession() {
  const token = await getSessionToken();

  if (token) {
    await connectToDatabase();
    await SessionModel.deleteOne({ tokenHash: hashSessionToken(token) });
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function hashSessionTokenForLookup(token: string) {
  return createHash("sha256").update(hashSessionToken(token)).digest("hex");
}

export { hashSessionToken };
