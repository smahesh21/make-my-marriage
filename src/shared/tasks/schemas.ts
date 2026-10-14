import { z } from "zod";

export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

const isoDateTimeWithOffsetSchema = z.string().refine(
  (value) => {
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return false;
    return !Number.isNaN(Date.parse(value));
  },
  "Use a valid date and time with an explicit timezone offset.",
);

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalObjectId = z.string().trim().min(1).optional().nullable();

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a task title.").max(200),
    description: optionalText(2000),
    assignedMembershipId: optionalObjectId,
    eventId: optionalObjectId,
    dueDate: isoDateTimeWithOffsetSchema.optional().nullable(),
    priority: taskPrioritySchema.default("MEDIUM"),
    status: taskStatusSchema.default("TODO"),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a task title.").max(200).optional(),
    description: optionalText(2000),
    assignedMembershipId: optionalObjectId,
    eventId: optionalObjectId,
    dueDate: isoDateTimeWithOffsetSchema.optional().nullable(),
    priority: taskPrioritySchema.optional(),
    status: taskStatusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one task detail to update.");

export const taskListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  eventId: z.string().trim().min(1).optional(),
  assignedMembershipId: z.string().trim().min(1).optional(),
  mine: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
