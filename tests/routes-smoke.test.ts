import { describe, expect, it } from "vitest";

const smokeBaseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3001";
const smokeEnabled = Boolean(process.env.SMOKE_BASE_URL);
const smokeTestTimeout = 60_000;

describe("application route smoke", () => {
  for (const route of ["/", "/signup", "/login", "/forgot-password", "/reset-password", "/onboarding", "/settings/wedding", "/settings/members", "/member-invitations/test-token"]) {
    it.skipIf(!smokeEnabled)(`serves ${route}`, async () => {
      const response = await fetch(new URL(route, smokeBaseUrl));

      expect(response.status).toBe(200);
    }, smokeTestTimeout);
  }

  it.skipIf(!smokeEnabled)("protects the auth context endpoint for a fresh session", async () => {
    const response = await fetch(new URL("/api/auth/me", smokeBaseUrl));

    expect(response.status).toBe(401);
  }, smokeTestTimeout);

  it.skipIf(!smokeEnabled)("protects wedding creation for a fresh session", async () => {
    const response = await fetch(new URL("/api/wedding", smokeBaseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(401);
  }, smokeTestTimeout);

  it.skipIf(!smokeEnabled)("protects wedding member listing for a fresh session", async () => {
    const response = await fetch(new URL("/api/members", smokeBaseUrl));

    expect(response.status).toBe(401);
  }, smokeTestTimeout);

  it.skipIf(!smokeEnabled)("protects member invitations for a fresh session", async () => {
    const response = await fetch(new URL("/api/members/invitations", smokeBaseUrl));

    expect(response.status).toBe(401);
  }, smokeTestTimeout);

  it.skipIf(!smokeEnabled)("protects wedding details updates for a fresh session", async () => {
    const response = await fetch(new URL("/api/wedding", smokeBaseUrl), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brideName: "Updated Name" }),
    });

    expect(response.status).toBe(401);
  }, smokeTestTimeout);

  it.skipIf(!smokeEnabled)("rejects a foreign origin on wedding creation", async () => {
    const response = await fetch(new URL("/api/wedding", smokeBaseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(403);
  }, smokeTestTimeout);
});
