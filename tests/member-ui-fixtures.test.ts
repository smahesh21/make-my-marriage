import { describe, expect, it } from "vitest";

import { memberUiFixtures } from "./fixtures/member-ui-states";

describe("member UI fixtures", () => {
  it("keeps the recommended acceptance and workspace states available", () => {
    expect(memberUiFixtures.map((fixture) => fixture.state)).toEqual([
      "empty-members",
      "active-invitation",
      "expired-invitation",
      "email-mismatch",
      "signed-out",
      "acceptance-success",
    ]);
  });

  it("uses unique fixture ids and navigable paths", () => {
    const ids = memberUiFixtures.map((fixture) => fixture.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(memberUiFixtures.every((fixture) => fixture.path.startsWith("/"))).toBe(true);
  });
});
