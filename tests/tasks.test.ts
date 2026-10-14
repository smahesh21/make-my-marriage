import { describe, expect, it } from "vitest";

import { createTaskSchema, taskListQuerySchema, updateTaskSchema } from "../src/shared/tasks/schemas";

describe("wedding task schemas", () => {
  it("applies the documented defaults for a simple task", () => {
    expect(createTaskSchema.parse({ title: "Confirm the caterer" })).toMatchObject({
      title: "Confirm the caterer",
      priority: "MEDIUM",
      status: "TODO",
    });
  });

  it("accepts explicit due-date offsets and nullable associations", () => {
    expect(createTaskSchema.parse({
      title: "Finalize the Sangeet playlist",
      assignedMembershipId: null,
      eventId: null,
      dueDate: "2027-02-10T18:30:00.000Z",
      priority: "HIGH",
      status: "IN_PROGRESS",
    })).toMatchObject({ priority: "HIGH", status: "IN_PROGRESS" });
  });

  it("rejects client-owned wedding scope and invalid date values", () => {
    expect(createTaskSchema.safeParse({ title: "Task", weddingId: "foreign-wedding" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "Task", dueDate: "2027-02-10" }).success).toBe(false);
  });

  it("requires a non-empty partial update", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.parse({ status: "COMPLETED" })).toEqual({ status: "COMPLETED" });
  });

  it("parses task list filters and pagination", () => {
    expect(taskListQuerySchema.parse({ page: "2", limit: "50", mine: "true", eventId: "none" })).toEqual({
      page: 2,
      limit: 50,
      mine: true,
      eventId: "none",
    });
  });

});
