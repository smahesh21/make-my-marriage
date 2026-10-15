import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as invitation } from "@/app/api/guests/[guestId]/send-invitation/route";
import { POST as reminder } from "@/app/api/guests/[guestId]/send-reminder/route";
import { readGuestJson } from "@/app/api/guests/context";
import { getAuthContext } from "@/server/auth/context";
import { sendGuestInvitation } from "@/modules/guests/invitations";

vi.mock("@/modules/guests/invitations", () => ({
  sendGuestInvitation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/auth/context", () => ({
  getAuthContext: vi.fn(async () => ({
    membership: { weddingId: "trusted-wedding", role: "ADMIN" },
    wedding: { id: "trusted-wedding" },
  })),
}));

const origin = "http://localhost:3001";
const params = { params: Promise.resolve({ guestId: "guest-a" }) };
function request(body?: string, requestOrigin = origin) {
  return new Request(`${origin}/api/guests/guest-a/send-invitation`, {
    method: "POST",
    headers: { Origin: requestOrigin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body }),
  });
}
beforeEach(() => vi.clearAllMocks());

describe.each([
  ["invitation", invitation],
  ["reminder", reminder],
] as const)("guest %s email request parsing", (kind, route) => {
  it.each([undefined, "", "{}"])(
    "accepts an empty command body %j",
    async (body) => {
      const input = request(body);
      // An empty stream is not the same as request.body === null.
      if (body === "") expect(input.body).not.toBeNull();
      const response = await route(input, params);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(sendGuestInvitation).toHaveBeenCalledExactlyOnceWith(
        "trusted-wedding",
        "guest-a",
        kind,
        input,
      );
    },
  );
  it.each([
    "{",
    " ",
    "null",
    "[]",
    '{"email":"other@example.test"}',
    '{"weddingId":"other"}',
  ])("rejects invalid or unexpected input %s without sending", async (body) => {
    const response = await route(request(body), params);
    expect(response.status).toBe(400);
    expect(sendGuestInvitation).not.toHaveBeenCalled();
  });
  it("keeps the request size limit", async () => {
    const response = await route(request(" ".repeat(8193)), params);
    expect(response.status).toBe(413);
    expect(sendGuestInvitation).not.toHaveBeenCalled();
  });
  it("authenticates before processing the command", async () => {
    vi.mocked(getAuthContext).mockResolvedValueOnce(null);
    expect((await route(request(""), params)).status).toBe(401);
    expect(sendGuestInvitation).not.toHaveBeenCalled();
  });
  it("rejects cross-origin commands", async () => {
    expect(
      (await route(request("{}", "https://attacker.test"), params)).status,
    ).toBe(403);
    expect(sendGuestInvitation).not.toHaveBeenCalled();
  });
});

it.each([undefined, ""])(
  "still requires JSON for guest data mutations (%j)",
  async (body) => {
    await expect(readGuestJson(request(body))).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  },
);
