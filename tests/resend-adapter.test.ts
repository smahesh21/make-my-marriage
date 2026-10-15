import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmailThroughResend } from "@/server/email/resend";
const email = {
  to: "synthetic@example.test",
  subject: "Test",
  html: "<p>Test</p>",
  text: "Test",
  idempotencyKey: "synthetic-email-attempt",
};
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "synthetic-test-key");
  vi.stubEnv("RESEND_FROM_EMAIL", "test@example.test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Resend provider acceptance", () => {
  it("includes a timeout and idempotency header and accepts only a provider message ID", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "synthetic-message" }));
    vi.stubGlobal("fetch", fetch);
    await expect(sendEmailThroughResend(email)).resolves.toBeUndefined();
    expect(fetch.mock.calls[0]![1].headers["Idempotency-Key"]).toBe(
      "synthetic-email-attempt",
    );
    expect(fetch.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).not.toHaveProperty(
      "idempotencyKey",
    );
  });
  it.each(["not-json", JSON.stringify({}), JSON.stringify({ id: "" })])(
    "rejects malformed provider success %s",
    async (body) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
      await expect(sendEmailThroughResend(email)).rejects.toMatchObject({
        code: "EMAIL_DELIVERY_FAILED",
        status: 503,
      });
    },
  );
  it.each([400, 401, 403, 429, 500])(
    "handles provider HTTP %s without returning provider secrets",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response("Sensitive provider detail", { status }),
          ),
      );
      await expect(sendEmailThroughResend(email)).rejects.toMatchObject({
        code: "EMAIL_DELIVERY_FAILED",
        status: 503,
        message: expect.not.stringContaining("Sensitive"),
      });
    },
  );
  it("does not retry a lost provider response automatically", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("network"));
    vi.stubGlobal("fetch", fetch);
    await expect(sendEmailThroughResend(email)).rejects.toMatchObject({
      code: "EMAIL_DELIVERY_FAILED",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
