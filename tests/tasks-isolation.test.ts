import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as listTasks, POST as createTask } from "@/app/api/tasks/route";
import { DELETE as deleteTask, GET as getTask, PATCH as updateTask } from "@/app/api/tasks/[taskId]/route";
import { getWeddingTaskDashboard } from "@/modules/tasks/use-cases";
import { createSession } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db/mongoose";
import { SessionModel } from "@/server/models/session";
import { UserModel } from "@/server/models/user";
import { WeddingModel } from "@/server/models/wedding";
import { WeddingEventModel } from "@/server/models/wedding-event";
import { WeddingMembershipModel } from "@/server/models/wedding-membership";
import { WeddingTaskModel } from "@/server/models/wedding-task";

// Only Next's incoming cookie store is simulated. Sessions, authentication,
// membership resolution, route handlers and database queries are real.
const cookie = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => cookie.token ? { value: cookie.token } : undefined,
    set: (_name: string, value: string) => { cookie.token = value; },
    delete: () => { cookie.token = null; },
  }),
}));

const origin = "http://localhost:3001";
const id = () => new mongoose.Types.ObjectId();
const a = { wedding: id(), admin: id(), manager: id(), adminMembership: id(), managerMembership: id(), event: id(), task: id() };
const b = { wedding: id(), admin: id(), manager: id(), adminMembership: id(), managerMembership: id(), event: id(), task: id() };
const dbName = "tasks_qa_isolation";
let database: MongoMemoryServer | undefined;

function request(path = "/api/tasks", method = "GET", body?: unknown) {
  return new Request(`${origin}${path}`, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const params = (taskId: mongoose.Types.ObjectId) => ({ params: Promise.resolve({ taskId: taskId.toString() }) });

beforeAll(async () => {
  database = await MongoMemoryServer.create({ binary: { version: "8.2.6" }, instance: { dbName } });
  vi.stubEnv("MONGODB_URI", database.getUri());
  vi.stubEnv("MONGO_DB_NAME", dbName);
  vi.stubEnv("SESSION_SECRET", "disposable-tasks-qa-session-secret-only");
  await connectToDatabase();
  await Promise.all([UserModel, WeddingModel, WeddingMembershipModel, WeddingEventModel, WeddingTaskModel, SessionModel].map((model) => model.init()));
}, 600_000);

beforeEach(async () => {
  // Refuse cleanup unless connected to the temporary server created above.
  expect(mongoose.connection.name).toBe(dbName);
  expect(mongoose.connection.port).toBe(database?.instanceInfo?.port);
  await Promise.all([UserModel, WeddingModel, WeddingMembershipModel, WeddingEventModel, WeddingTaskModel, SessionModel].map((model) => model.collection.deleteMany({})));
  cookie.token = null;
  for (const [label, fixture] of [["A", a], ["B", b]] as const) {
    await UserModel.create([
      { _id: fixture.admin, name: `${label} Admin`, email: `admin-${label}@example.test`, emailNormalized: `admin-${label}@example.test`, passwordHash: "test-only" },
      { _id: fixture.manager, name: `${label} Manager`, email: `manager-${label}@example.test`, emailNormalized: `manager-${label}@example.test`, passwordHash: "test-only" },
    ]);
    await WeddingModel.create({
      _id: fixture.wedding, brideName: `${label} Bride`, groomName: `${label} Groom`, weddingDate: "2027-02-10",
      location: { city: "Test city" }, website: { slug: `test-wedding-${label}` },
      gallery: { token: `test-gallery-${label}` }, createdByUserId: fixture.admin,
    });
    await WeddingMembershipModel.create([
      { _id: fixture.adminMembership, weddingId: fixture.wedding, userId: fixture.admin, role: "ADMIN" },
      { _id: fixture.managerMembership, weddingId: fixture.wedding, userId: fixture.manager, role: "MANAGER" },
    ]);
    await WeddingEventModel.create({ _id: fixture.event, weddingId: fixture.wedding, name: `${label} private event`, startsAt: new Date() });
    await WeddingTaskModel.create({
      _id: fixture.task, weddingId: fixture.wedding, title: `${label} private task`, description: `${label} private description`,
      assignedMembershipId: fixture.managerMembership, eventId: fixture.event,
      dueDate: new Date(Date.now() + 86_400_000),
    });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await database?.stop();
  vi.unstubAllEnvs();
});

describe("task tenant isolation using real MongoDB and sessions", () => {
  for (const [label, own, foreign] of [["A", a, b], ["B", b, a]] as const) {
    for (const role of ["admin", "manager"] as const) {
      it(`${label} ${role} can list only their wedding, including relations and dashboard counts`, async () => {
        await createSession(own[role].toString());
        const response = await listTasks(request());
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.pagination.total).toBe(1);
        expect(body.data.data).toHaveLength(1);
        expect(body.data.data[0]).toMatchObject({
          id: own.task.toString(),
          event: { id: own.event.toString() },
          assignee: { membershipId: own.managerMembership.toString(), name: `${label} Manager` },
        });
        expect(JSON.stringify(body)).not.toContain(foreign.task.toString());
        expect(JSON.stringify(body)).not.toContain("@example.test");
        const summary = await getWeddingTaskDashboard(own.wedding.toString(), own.managerMembership.toString());
        expect(summary.summary).toMatchObject({ total: 1, completed: 0, assignedToCurrent: 1, dueSoon: 1 });
        expect(summary.upcomingTasks.map((task) => task.id)).toEqual([own.task.toString()]);
      });

      it(`${label} ${role} cannot read, edit, complete or delete the other wedding's task`, async () => {
        await createSession(own[role].toString());
        const missing = await getTask(request(), params(id()));
        const foreignRead = await getTask(request(), params(foreign.task));
        expect(foreignRead.status).toBe(404);
        expect(await foreignRead.json()).toEqual(await missing.json());
        for (const body of [{ title: "Overwritten" }, { status: "COMPLETED" }]) {
          const response = await updateTask(request("/api/tasks/item", "PATCH", body), params(foreign.task));
          expect(response.status).toBe(404);
        }
        const deleted = await deleteTask(request("/api/tasks/item", "DELETE"), params(foreign.task));
        expect(deleted.status).toBe(404);
        const unchanged = await WeddingTaskModel.findById(foreign.task).lean();
        expect(unchanged).toMatchObject({ title: `${label === "A" ? "B" : "A"} private task`, status: "TODO" });
      });

      it(`${label} ${role} cannot inject foreign task assignments or ceremonies`, async () => {
        await createSession(own[role].toString());
        for (const reference of [{ eventId: foreign.event.toString() }, { assignedMembershipId: foreign.managerMembership.toString() }]) {
          const created = await createTask(request("/api/tasks", "POST", { title: "Injected reference", ...reference }));
          expect(created.status).toBe(404);
          const updated = await updateTask(request("/api/tasks/item", "PATCH", reference), params(own.task));
          expect(updated.status).toBe(404);
        }
        expect(await WeddingTaskModel.countDocuments({})).toBe(2);
        expect(await WeddingTaskModel.findById(own.task).lean()).toMatchObject({ assignedMembershipId: own.managerMembership, eventId: own.event });
      });
    }
  }

  it("keeps foreign filters and a forged query weddingId within the authenticated wedding", async () => {
    await createSession(a.admin.toString());
    for (const filter of [`eventId=${b.event}`, `assignedMembershipId=${b.managerMembership}`, `mine=true&assignedMembershipId=${b.managerMembership}`, "mine=true&assignedMembershipId=none"]) {
      const response = await listTasks(request(`/api/tasks?${filter}`));
      expect(response.status).toBe(200);
      expect((await response.json()).data).toMatchObject({ data: [], pagination: { total: 0 } });
    }
    const forged = await listTasks(request(`/api/tasks?weddingId=${b.wedding}`));
    expect((await forged.json()).data.data.map((task: { id: string }) => task.id)).toEqual([a.task.toString()]);
    const mine = await listTasks(request("/api/tasks?mine=true"));
    expect((await mine.json()).data.data).toEqual([]);
  });

  it("rejects client-supplied ownership on create and update", async () => {
    await createSession(a.admin.toString());
    expect((await createTask(request("/api/tasks", "POST", { title: "Forged", weddingId: b.wedding.toString() }))).status).toBe(400);
    expect((await updateTask(request("/api/tasks/item", "PATCH", { weddingId: b.wedding.toString() }), params(a.task))).status).toBe(400);
  });

  it("allows an own-wedding edit and deletion while keeping the other wedding unchanged", async () => {
    await createSession(a.manager.toString());
    const edited = await updateTask(request("/api/tasks/item", "PATCH", { status: "COMPLETED" }), params(a.task));
    expect(edited.status).toBe(200);
    expect((await edited.json()).data.completedAt).toBeTruthy();
    expect((await deleteTask(request("/api/tasks/item", "DELETE"), params(a.task))).status).toBe(200);
    expect(await WeddingTaskModel.exists({ _id: a.task })).toBeNull();
    expect(await WeddingTaskModel.findById(b.task).lean()).toMatchObject({ status: "TODO" });
  });

  it("returns 401 for every task operation without a valid session", async () => {
    const responses = await Promise.all([
      listTasks(request()), createTask(request("/api/tasks", "POST", { title: "Unauthorized" })),
      getTask(request(), params(a.task)), updateTask(request("/api/tasks/item", "PATCH", { title: "Unauthorized" }), params(a.task)),
      deleteTask(request("/api/tasks/item", "DELETE"), params(a.task)),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
  });

  it("returns a sanitized 500 when the database query fails", async () => {
    await createSession(a.admin.toString());
    vi.spyOn(WeddingTaskModel, "find").mockImplementationOnce(() => { throw new Error("Sensitive database details"); });
    const response = await listTasks(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
  });

  it("returns 400 rather than 500 for malformed JSON on create and update", async () => {
    await createSession(a.admin.toString());
    const malformed = (method: string) => new Request(`${origin}/api/tasks`, { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: "{" });
    for (const response of [await createTask(malformed("POST")), await updateTask(malformed("PATCH"), params(a.task))]) {
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    }
    expect(await WeddingTaskModel.countDocuments({})).toBe(2);
  });
});
