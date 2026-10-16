import { afterEach, describe, expect, it, vi } from "vitest";
import { photoApi } from "@/app/photos/api";
import { matchesImageSignature } from "@/server/storage/r2";
afterEach(() => vi.unstubAllGlobals());
describe("photo API recovery", () => {
  it.each([400, 401, 403, 404, 409, 429, 500, 503])(
    "preserves status %s without replaying a mutation",
    async (status) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response("<html>Temporary failure</html>", {
            status,
            headers: { "Retry-After": "60" },
          }),
        );
      vi.stubGlobal("fetch", fetch);
      await expect(
        photoApi("/api/photos", { method: "POST" }),
      ).rejects.toMatchObject({ status, retryAfter: 60 });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it("handles network and unexpected response failures without exposing raw errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError("private provider details"))
        .mockResolvedValueOnce(Response.json({ unknown: true })),
    );
    await expect(photoApi("/api/photos")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
    await expect(photoApi("/api/photos")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});
describe("bounded photo signature checking", () => {
  it("recognises only the supported file signatures", () => {
    expect(
      matchesImageSignature(Uint8Array.from([255, 216, 255]), "image/jpeg"),
    ).toBe(true);
    expect(
      matchesImageSignature(
        Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      matchesImageSignature(Buffer.from("RIFF1234WEBP"), "image/webp"),
    ).toBe(true);
    expect(matchesImageSignature(Buffer.from("<svg>"), "image/png")).toBe(
      false,
    );
    expect(matchesImageSignature(new Uint8Array(), "image/jpeg")).toBe(false);
    expect(
      matchesImageSignature(Buffer.from("RIFF1234WAVE"), "image/webp"),
    ).toBe(false);
  });
});
