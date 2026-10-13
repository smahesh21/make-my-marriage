import { describe, expect, it } from "vitest";

import { createEventSchema, updateEventSchema } from "../src/shared/events/schemas";

describe("wedding event schemas", () => {
  it("accepts a preset event with UTC timestamps", () => {
    expect(createEventSchema.parse({
      name: "Mehendi",
      type: "MEHENDI",
      startsAt: "2027-02-12T10:30:00.000Z",
      endsAt: "2027-02-12T14:30:00.000Z",
      venueName: "Royal Garden",
    })).toMatchObject({ name: "Mehendi", type: "MEHENDI" });
  });

  it("requires explicit offsets and an end after the start", () => {
    expect(createEventSchema.safeParse({ name: "Wedding", startsAt: "2027-02-14T10:30", endsAt: null }).success).toBe(false);
    expect(createEventSchema.safeParse({ name: "Wedding", startsAt: "2027-02-14T14:30:00.000Z", endsAt: "2027-02-14T10:30:00.000Z" }).success).toBe(false);
  });

  it("allows partial edits and clearing the optional end time", () => {
    expect(updateEventSchema.parse({ endsAt: null })).toEqual({ endsAt: null });
    expect(updateEventSchema.safeParse({}).success).toBe(false);
    expect(updateEventSchema.safeParse({ weddingId: "foreign-wedding" }).success).toBe(false);
  });
});

