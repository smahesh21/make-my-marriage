import { describe, expect, it } from "vitest";

import { inviteMemberSchema, memberRoleSchema, updateMemberRoleSchema } from "../src/shared/members/schemas";

describe("wedding member schemas", () => {
  it("accepts an invitation email and supported role", () => {
    expect(inviteMemberSchema.parse({ email: "  Rahul@example.com ", role: "MANAGER" })).toEqual({
      email: "Rahul@example.com",
      role: "MANAGER",
    });
  });

  it("rejects invalid invitation emails and unsupported roles", () => {
    expect(inviteMemberSchema.safeParse({ email: "not-an-email", role: "MANAGER" }).success).toBe(false);
    expect(memberRoleSchema.safeParse("OWNER").success).toBe(false);
  });

  it("accepts only documented role updates", () => {
    expect(updateMemberRoleSchema.parse({ role: "ADMIN" })).toEqual({ role: "ADMIN" });
    expect(updateMemberRoleSchema.safeParse({}).success).toBe(false);
  });
});
