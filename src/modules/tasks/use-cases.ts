import mongoose from "mongoose";

import { connectToDatabase } from "@/server/db/mongoose";
import { UserModel } from "@/server/models/user";
import { WeddingEventModel } from "@/server/models/wedding-event";
import { WeddingMembershipModel } from "@/server/models/wedding-membership";
import { WeddingTaskModel } from "@/server/models/wedding-task";
import { AppError } from "@/shared/errors";
import type { CreateTaskInput, TaskListQuery, UpdateTaskInput } from "@/shared/tasks/schemas";

type TaskDocument = {
  _id: mongoose.Types.ObjectId;
  weddingId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  assignedMembershipId?: mongoose.Types.ObjectId | null;
  eventId?: mongoose.Types.ObjectId | null;
  dueDate?: Date | null;
  priority: string;
  status: string;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MembershipDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: string;
};

type UserDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

type EventDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  archivedAt?: Date | null;
};

type TaskRelations = {
  membershipsById: Map<string, MembershipDocument>;
  usersById: Map<string, UserDocument>;
  eventsById: Map<string, EventDocument>;
};

function isObjectId(value: string) {
  return mongoose.isValidObjectId(value);
}

function relationId(value: mongoose.Types.ObjectId | null | undefined) {
  return value?.toString() ?? null;
}

async function loadTaskRelations(weddingId: string, tasks: TaskDocument[]): Promise<TaskRelations> {
  const membershipIds = [...new Set(tasks.flatMap((task) => (task.assignedMembershipId ? [task.assignedMembershipId.toString()] : [])))];
  const eventIds = [...new Set(tasks.flatMap((task) => (task.eventId ? [task.eventId.toString()] : [])))];

  const [memberships, events] = await Promise.all([
    membershipIds.length > 0 ? WeddingMembershipModel.find({ _id: { $in: membershipIds }, weddingId }).lean() : [],
    eventIds.length > 0 ? WeddingEventModel.find({ _id: { $in: eventIds }, weddingId }).lean() : [],
  ]);
  const userIds = memberships.map((membership) => membership.userId);
  const users = userIds.length > 0 ? await UserModel.find({ _id: { $in: userIds } }).lean() : [];

  return {
    membershipsById: new Map(memberships.map((membership) => [membership._id.toString(), membership as MembershipDocument])),
    usersById: new Map(users.map((user) => [user._id.toString(), user as UserDocument])),
    eventsById: new Map(events.map((event) => [event._id.toString(), event as EventDocument])),
  };
}

function serializeTask(task: TaskDocument, relations: TaskRelations) {
  const assignedMembershipId = relationId(task.assignedMembershipId);
  const eventId = relationId(task.eventId);
  const membership = assignedMembershipId ? relations.membershipsById.get(assignedMembershipId) : undefined;
  const user = membership ? relations.usersById.get(membership.userId.toString()) : undefined;
  const event = eventId ? relations.eventsById.get(eventId) : undefined;

  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description ?? null,
    assignedMembershipId,
    eventId,
    dueDate: task.dueDate?.toISOString() ?? null,
    priority: task.priority as "LOW" | "MEDIUM" | "HIGH",
    status: task.status as "TODO" | "IN_PROGRESS" | "COMPLETED",
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    assignee: membership && user
      ? { membershipId: membership._id.toString(), name: user.name, role: membership.role as "ADMIN" | "MANAGER" }
      : null,
    event: event
      ? { id: event._id.toString(), name: event.name, archivedAt: event.archivedAt?.toISOString() ?? null }
      : null,
  };
}

async function serializeTasks(weddingId: string, tasks: TaskDocument[]) {
  const relations = await loadTaskRelations(weddingId, tasks);
  return tasks.map((task) => serializeTask(task, relations));
}

async function assertActiveMembership(weddingId: string, membershipId: string) {
  if (!isObjectId(membershipId)) throw new AppError("NOT_FOUND", "The assigned member could not be found.", 404);
  const membership = await WeddingMembershipModel.exists({ _id: membershipId, weddingId });
  if (!membership) throw new AppError("NOT_FOUND", "The assigned member could not be found.", 404);
}

async function assertEventReference(weddingId: string, eventId: string, existingEventId?: string | null) {
  if (!isObjectId(eventId)) throw new AppError("NOT_FOUND", "The selected event could not be found.", 404);
  const event = await WeddingEventModel.findOne({ _id: eventId, weddingId }).lean();
  if (!event) throw new AppError("NOT_FOUND", "The selected event could not be found.", 404);
  if (event.archivedAt && eventId !== existingEventId) {
    throw new AppError("NOT_FOUND", "The selected event could not be found.", 404);
  }
}

function buildTaskFilter(weddingId: string, query: TaskListQuery, currentMembershipId: string) {
  const filter: Record<string, unknown> = { weddingId };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;

  if (query.eventId) {
    if (query.eventId === "none") filter.eventId = null;
    else {
      if (!isObjectId(query.eventId)) throw new AppError("VALIDATION_ERROR", "The event filter is invalid.", 400);
      filter.eventId = query.eventId;
    }
  }

  if (query.assignedMembershipId) {
    if (query.assignedMembershipId === "none") filter.assignedMembershipId = null;
    else {
      if (!isObjectId(query.assignedMembershipId)) throw new AppError("VALIDATION_ERROR", "The assignee filter is invalid.", 400);
      filter.assignedMembershipId = query.assignedMembershipId;
    }
  }

  if (query.mine) {
    if (query.assignedMembershipId && query.assignedMembershipId !== currentMembershipId) {
      filter.$and = [{ assignedMembershipId: currentMembershipId }, { assignedMembershipId: query.assignedMembershipId }];
    } else {
      filter.assignedMembershipId = currentMembershipId;
    }
  }

  return filter;
}

export async function listWeddingTasks(weddingId: string, currentMembershipId: string, query: TaskListQuery) {
  await connectToDatabase();
  const filter = buildTaskFilter(weddingId, query, currentMembershipId);
  const [total, tasks] = await Promise.all([
    WeddingTaskModel.countDocuments(filter),
    WeddingTaskModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
  ]);

  return {
    data: await serializeTasks(weddingId, tasks as TaskDocument[]),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getWeddingTask(weddingId: string, taskId: string) {
  if (!isObjectId(taskId)) throw new AppError("NOT_FOUND", "The task could not be found.", 404);
  await connectToDatabase();
  const task = await WeddingTaskModel.findOne({ _id: taskId, weddingId }).lean();
  if (!task) throw new AppError("NOT_FOUND", "The task could not be found.", 404);
  return (await serializeTasks(weddingId, [task as TaskDocument]))[0];
}

export async function createWeddingTask(weddingId: string, input: CreateTaskInput) {
  await connectToDatabase();
  if (input.assignedMembershipId) await assertActiveMembership(weddingId, input.assignedMembershipId);
  if (input.eventId) await assertEventReference(weddingId, input.eventId);

  const status = input.status ?? "TODO";
  const task = await WeddingTaskModel.create({
    weddingId,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    ...(input.assignedMembershipId ? { assignedMembershipId: input.assignedMembershipId } : {}),
    ...(input.eventId ? { eventId: input.eventId } : {}),
    ...(input.dueDate ? { dueDate: new Date(input.dueDate) } : {}),
    priority: input.priority ?? "MEDIUM",
    status,
    ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
  });

  return (await serializeTasks(weddingId, [task.toObject() as TaskDocument]))[0];
}

export async function updateWeddingTask(weddingId: string, taskId: string, input: UpdateTaskInput) {
  if (!isObjectId(taskId)) throw new AppError("NOT_FOUND", "The task could not be found.", 404);
  await connectToDatabase();
  const task = await WeddingTaskModel.findOne({ _id: taskId, weddingId }).lean();
  if (!task) throw new AppError("NOT_FOUND", "The task could not be found.", 404);

  if (input.assignedMembershipId) {
    const existingMembershipId = task.assignedMembershipId?.toString() ?? null;
    if (input.assignedMembershipId !== existingMembershipId) await assertActiveMembership(weddingId, input.assignedMembershipId);
  }
  if (input.eventId) await assertEventReference(weddingId, input.eventId, task.eventId?.toString());

  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  if (input.title !== undefined) set.title = input.title;
  if (input.description !== undefined) {
    if (input.description === "") unset.description = 1;
    else set.description = input.description;
  }
  if (input.assignedMembershipId !== undefined) {
    if (input.assignedMembershipId === null) unset.assignedMembershipId = 1;
    else set.assignedMembershipId = input.assignedMembershipId;
  }
  if (input.eventId !== undefined) {
    if (input.eventId === null) unset.eventId = 1;
    else set.eventId = input.eventId;
  }
  if (input.dueDate !== undefined) {
    if (input.dueDate === null) unset.dueDate = 1;
    else set.dueDate = new Date(input.dueDate);
  }
  if (input.priority !== undefined) set.priority = input.priority;
  if (input.status !== undefined) {
    set.status = input.status;
    if (input.status === "COMPLETED" && task.status !== "COMPLETED") set.completedAt = new Date();
    if (input.status !== "COMPLETED") unset.completedAt = 1;
  }

  const update: { $set?: Record<string, unknown>; $unset?: Record<string, 1> } = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;

  const updated = await WeddingTaskModel.findOneAndUpdate(
    { _id: taskId, weddingId, updatedAt: task.updatedAt },
    update,
    { new: true, runValidators: true },
  ).lean();
  if (!updated) throw new AppError("CONFLICT", "The task changed before it could be updated. Reload and try again.", 409);
  return (await serializeTasks(weddingId, [updated as TaskDocument]))[0];
}

export async function deleteWeddingTask(weddingId: string, taskId: string) {
  if (!isObjectId(taskId)) throw new AppError("NOT_FOUND", "The task could not be found.", 404);
  await connectToDatabase();
  const result = await WeddingTaskModel.deleteOne({ _id: taskId, weddingId });
  if (result.deletedCount !== 1) throw new AppError("NOT_FOUND", "The task could not be found.", 404);
}

export async function getWeddingTaskDashboard(weddingId: string, currentMembershipId: string) {
  await connectToDatabase();
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const openFilter: Record<string, unknown> = { weddingId, status: { $ne: "COMPLETED" } };

  const [total, completed, dueSoon, assignedToCurrent, upcomingTasks] = await Promise.all([
    WeddingTaskModel.countDocuments({ weddingId }),
    WeddingTaskModel.countDocuments({ weddingId, status: "COMPLETED" }),
    WeddingTaskModel.countDocuments({ ...openFilter, dueDate: { $gte: now, $lte: nextWeek } }),
    WeddingTaskModel.countDocuments({ ...openFilter, assignedMembershipId: currentMembershipId }),
    WeddingTaskModel.find({ ...openFilter, dueDate: { $gte: now } })
      .sort({ dueDate: 1, _id: 1 })
      .limit(5)
      .lean(),
  ]);

  return {
    summary: { total, completed, dueSoon, assignedToCurrent },
    upcomingTasks: await serializeTasks(weddingId, upcomingTasks as TaskDocument[]),
  };
}
