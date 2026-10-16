import { describe, expect, it } from "vitest";

const smokeBaseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3001";
const smokeEnabled = Boolean(process.env.SMOKE_BASE_URL);
const smokeTestTimeout = 60_000;

describe("application route smoke", () => {
  for (const route of ["/", "/signup", "/login", "/forgot-password", "/reset-password", "/onboarding", "/dashboard", "/events", "/tasks", "/guests", "/photos", "/invite/not-a-real-token", "/settings/wedding", "/settings/members", "/member-invitations/test-token"]) {
    it.skipIf(!smokeEnabled)(`serves ${route}`, async () => {
      const response = await fetch(new URL(route, smokeBaseUrl));

      expect(response.status).toBe(200);
    }, smokeTestTimeout);
  }

  it.skipIf(!smokeEnabled)("protects the auth context endpoint for a fresh session", async () => {
    const response = await fetch(new URL("/api/auth/me", smokeBaseUrl));

    expect(response.status).toBe(401);
  }, smokeTestTimeout);

  for (const [route, method] of [["/api/photos", "GET"], ["/api/photos", "POST"], ["/api/photos/upload-url", "POST"], ["/api/photos/000000000000000000000001", "DELETE"], ["/api/photos/000000000000000000000001/download", "GET"]]) {
    it.skipIf(!smokeEnabled)(`protects private photo ${method} ${route}`, async () => {
      const response = await fetch(new URL(route!, smokeBaseUrl), { method, headers: { Origin: new URL(smokeBaseUrl).origin } });
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    }, smokeTestTimeout);
  }

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

  it.skipIf(!smokeEnabled)("protects wedding event listing for a fresh session", async () => {
    const response = await fetch(new URL("/api/events", smokeBaseUrl));

    expect(response.status).toBe(401);
  }, smokeTestTimeout);

  it.skipIf(!smokeEnabled)("protects wedding task listing for a fresh session", async () => {
    const response = await fetch(new URL("/api/tasks", smokeBaseUrl));

    expect(response.status).toBe(401);
  }, smokeTestTimeout);

  for (const route of ["/api/guests", "/api/guests/rsvp-summary", "/api/guests/000000000000000000000001", "/api/guests/000000000000000000000001/invitation-link"]) {
    it.skipIf(!smokeEnabled)(`protects ${route} for a fresh session`, async () => {
      const response = await fetch(new URL(route, smokeBaseUrl));
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    }, smokeTestTimeout);
  }

  for (const action of ["send-invitation", "send-reminder"]) {
    it.skipIf(!smokeEnabled)(`protects guest ${action} for a fresh session`, async () => {
      const response = await fetch(new URL(`/api/guests/000000000000000000000001/${action}`, smokeBaseUrl), { method: "POST" });
      expect(response.status).toBe(401);
    }, smokeTestTimeout);
  }
  it.skipIf(!smokeEnabled)("invalid public invitation reads are private, generic and unavailable", async () => {
    const response = await fetch(new URL("/api/public/invitations/not-a-real-token", smokeBaseUrl));
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  }, smokeTestTimeout);
  it.skipIf(!smokeEnabled)("invalid public RSVP links are rejected without authentication or database writes", async () => {
    const response = await fetch(new URL("/api/public/invitations/not-a-real-token/rsvp", smokeBaseUrl), { method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(smokeBaseUrl).origin }, body: JSON.stringify({ status: "ATTENDING", attendingCount: 1 }) });
    expect(response.status).toBe(404);
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
