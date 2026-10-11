import { describe, expect, it } from "vitest";

import { assertSameOrigin } from "../src/server/http/request-security";

describe("authenticated request security", () => {
  it("accepts a same-origin mutation request", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:3001/api/wedding", {
          method: "POST",
          headers: { Host: "localhost:3001", Origin: "http://localhost:3001" },
        }),
      ),
    ).not.toThrow();
  });

  it("rejects a mismatched origin or host", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:3001/api/wedding", {
          method: "POST",
          headers: { Host: "localhost:3001", Origin: "https://attacker.example" },
        }),
      ),
    ).toThrowError("This request origin is not allowed.");

    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:3001/api/wedding", {
          method: "POST",
          headers: { Host: "attacker.example", Origin: "http://localhost:3001" },
        }),
      ),
    ).toThrowError("This request origin is not allowed.");
  });
});
