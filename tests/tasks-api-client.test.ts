import { afterEach, describe, expect, it, vi } from "vitest";

import { requestTaskApi } from "@/app/tasks/api";

afterEach(() => vi.unstubAllGlobals());

describe("task API failure handling", () => {
  it.each([400, 403, 404, 409, 429, 500, 503])("preserves the error status and message for HTTP %s", async (status) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: { code: "TEST_FAILURE", message: "Please retry the task request." } }, { status }));
    vi.stubGlobal("fetch", fetch);
    await expect(requestTaskApi("/api/tasks")).rejects.toMatchObject({ status, code: "TEST_FAILURE", message: "Please retry the task request." });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("recognizes a 401 even when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not authenticated", { status: 401 })));
    await expect(requestTaskApi("/api/tasks")).rejects.toMatchObject({ status: 401, message: expect.stringContaining("Sign in again") });
  });

  it("hides HTML proxy errors and allows a later explicit retry", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html>Internal proxy details</html>", { status: 502 }))
      .mockResolvedValueOnce(Response.json({ data: [] }));
    vi.stubGlobal("fetch", fetch);
    await expect(requestTaskApi("/api/tasks")).rejects.toMatchObject({ status: 502, message: "Unable to complete this request. Please try again." });
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(requestTaskApi("/api/tasks")).resolves.toEqual({ data: [] });
  });

  it("reports a network failure without automatically replaying a write", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetch);
    await expect(requestTaskApi("/api/tasks", { method: "POST" })).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR", message: expect.stringContaining("Check your connection") });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal);
  });

  it("reports timeouts as retryable request errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));
    await expect(requestTaskApi("/api/tasks")).rejects.toMatchObject({ status: 0, code: "REQUEST_TIMEOUT" });
  });

  it.each(["not json", JSON.stringify({ unexpected: [] })])("rejects an invalid successful response: %s", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    await expect(requestTaskApi("/api/tasks")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
