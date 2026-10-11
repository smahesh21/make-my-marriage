import { createHmac } from "node:crypto";

import { connectToDatabase } from "@/server/db/mongoose";
import { getRequiredEnv } from "@/server/config/env";
import { RateLimitCounterModel } from "@/server/models/rate-limit-counter";
import { RateLimitError } from "@/shared/errors";

type RateLimitRule = {
  name: string;
  limit: number;
  windowMs: number;
  identifier?: string;
};

export const AUTH_LOGIN_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 } as const;
export const AUTH_SIGNUP_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 } as const;
export const AUTH_FORGOT_PASSWORD_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 } as const;
export const AUTH_RESET_PASSWORD_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 } as const;

export function getClientIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown-client";
}

export async function enforceRateLimit(request: Request, rule: RateLimitRule) {
  const identifier = rule.identifier ?? getClientIdentifier(request);
  const now = Date.now();
  const windowStartMs = Math.floor(now / rule.windowMs) * rule.windowMs;
  const windowStartedAt = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + rule.windowMs + 60_000);
  const rawKey = `${rule.name}:${identifier}`;
  const keyHash = createHmac("sha256", getRequiredEnv("SESSION_SECRET")).update(rawKey).digest("hex");

  await connectToDatabase();

  let counter;
  try {
    counter = await RateLimitCounterModel.findOneAndUpdate(
      { keyHash, windowStartedAt },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;

    counter = await RateLimitCounterModel.findOneAndUpdate(
      { keyHash, windowStartedAt },
      { $inc: { count: 1 } },
      { new: true },
    ).lean();
  }

  if (!counter || counter.count <= rule.limit) return;

  const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + rule.windowMs - now) / 1000));
  throw new RateLimitError(retryAfterSeconds);
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
