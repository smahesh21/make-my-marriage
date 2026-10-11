import { describe, expect, it } from "vitest";

import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "../src/shared/auth/schemas";
import { createWeddingSchema, updateWeddingSchema } from "../src/shared/wedding/schemas";
import { slugify } from "../src/shared/wedding/slug";

describe("signup validation", () => {
  it("rejects passwords shorter than eight characters", () => {
    const result = signupSchema.safeParse({
      name: "Meera",
      email: "meera@example.com",
      password: "1234567",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toEqual(["Password must be at least 8 characters."]);
    }
  });

  it("rejects whitespace-only names and trims valid names", () => {
    const whitespaceName = signupSchema.safeParse({
      name: "   ",
      email: "meera@example.com",
      password: "password123",
    });
    const trimmedName = signupSchema.safeParse({
      name: "  Meera  ",
      email: "meera@example.com",
      password: "password123",
    });

    expect(whitespaceName.success).toBe(false);
    if (!whitespaceName.success) {
      expect(whitespaceName.error.flatten().fieldErrors.name).toEqual(["Enter your full name."]);
    }
    expect(trimmedName.success).toBe(true);
    if (trimmedName.success) {
      expect(trimmedName.data.name).toBe("Meera");
    }
  });
});

describe("login options", () => {
  it("remembers the device by default and preserves an explicit opt-out", () => {
    expect(loginSchema.parse({ email: "person@example.com", password: "secret" }).rememberDevice).toBe(true);
    expect(loginSchema.parse({ email: "person@example.com", password: "secret", rememberDevice: false }).rememberDevice).toBe(false);
  });
});

describe("password recovery validation", () => {
  it("accepts a reset request and validates the new password", () => {
    expect(forgotPasswordSchema.parse({ email: "person@example.com" }).email).toBe("person@example.com");
    expect(resetPasswordSchema.safeParse({ token: "reset-token", password: "newpassword" }).success).toBe(true);
  });

  it("rejects invalid reset input", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "", password: "short" }).success).toBe(false);
  });
});

describe("wedding onboarding validation", () => {
  it("accepts the required wedding details", () => {
    const result = createWeddingSchema.safeParse({
      brideName: "Meera",
      groomName: "Aarav",
      weddingDate: "2026-12-18",
      timeZone: "Asia/Kolkata",
      location: { city: "Bengaluru" },
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid date and missing city", () => {
    const result = createWeddingSchema.safeParse({
      brideName: "Meera",
      groomName: "Aarav",
      weddingDate: "2026-02-30",
      timeZone: "Asia/Kolkata",
      location: {},
    });

    expect(result.success).toBe(false);
  });

  it("normalizes names into a stable URL-friendly slug", () => {
    expect(slugify("Meera & Aarav — Bengaluru 2026-12-18")).toBe("meera-aarav-bengaluru-2026-12-18");
  });
});

describe("wedding details update validation", () => {
  it("accepts a partial update without allowing the client to change the slug", () => {
    const result = updateWeddingSchema.safeParse({
      brideName: "  Meera  ",
      location: { state: "Karnataka" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brideName).toBe("Meera");
      expect(result.data.location?.state).toBe("Karnataka");
    }
  });

  it("rejects an empty update and invalid wedding dates", () => {
    expect(updateWeddingSchema.safeParse({}).success).toBe(false);
    expect(updateWeddingSchema.safeParse({ weddingDate: "2027-02-30" }).success).toBe(false);
  });
});
