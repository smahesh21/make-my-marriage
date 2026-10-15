import { afterEach, describe, expect, it, vi } from "vitest";
import { requestGuestApi } from "@/app/guests/api";
afterEach(() => vi.unstubAllGlobals());
describe("guest API recovery", () => {
  it.each([400, 401, 403, 404, 409, 429, 500, 503])("preserves HTTP %s without replaying requests", async (status) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: { code: "FAILURE", message: "Please retry.", fields: { name: ["Required"] } } }, { status }));
    vi.stubGlobal("fetch", fetch);
    await expect(requestGuestApi("/api/guests", { method: "POST" })).rejects.toMatchObject({ status, fields: { name: ["Required"] } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("handles HTML errors, timeouts and ambiguous network failures", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("<html>Proxy detail</html>", { status: 502 }))
      .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError")).mockRejectedValueOnce(new TypeError("network"));
    vi.stubGlobal("fetch", fetch);
    await expect(requestGuestApi("/api/guests")).rejects.toMatchObject({ status: 502, message: "Unable to complete this request. Please try again." });
    await expect(requestGuestApi("/api/guests")).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
    await expect(requestGuestApi("/api/guests", { method: "POST" })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("rejects unexpected success payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ unexpected: true })));
    await expect(requestGuestApi("/api/guests")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
