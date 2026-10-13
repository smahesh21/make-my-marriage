import { describe, expect, it } from "vitest";

import { getResendFailureMessage } from "../src/shared/email/errors";

describe("Resend delivery errors", () => {
  it("distinguishes invalid API keys from sender restrictions", () => {
    expect(getResendFailureMessage(401, "fallback")).toContain("RESEND_API_KEY");
    expect(getResendFailureMessage(403, "fallback")).toContain("onboarding@resend.dev");
  });

  it("keeps provider-specific messages for common delivery failures", () => {
    expect(getResendFailureMessage(400, "fallback")).toContain("sender or recipient");
    expect(getResendFailureMessage(429, "fallback")).toContain("rate-limited");
    expect(getResendFailureMessage(500, "fallback")).toBe("fallback");
  });
});
