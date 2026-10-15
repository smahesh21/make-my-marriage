// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TasksPage from "@/app/tasks/page";

vi.mock("@/app/workspace/WorkspaceSidebar", () => ({ WorkspaceSidebar: () => <aside>Workspace navigation</aside> }));

const task = {
  id: "task-a", title: "Confirm the caterer", description: "Keep these instructions",
  assignedMembershipId: "member-a", eventId: null, dueDate: null, priority: "MEDIUM", status: "TODO",
  completedAt: null as string | null, createdAt: "2026-10-15T00:00:00.000Z", updatedAt: "2026-10-15T00:00:00.000Z",
  assignee: { membershipId: "member-a", name: "QA Admin", role: "ADMIN" }, event: null,
};

let tasks = [{ ...task }];
let failingEndpoint: string | null;
let failureStatus: number;
let mutationFailure: "http" | "network" | null;
let failRefreshAfterSave: boolean;
let fetchMock: ReturnType<typeof vi.fn>;

const failure = () => Response.json({ error: { code: "TEST_FAILURE", message: "The task request failed. Please try again." } }, { status: failureStatus });

beforeEach(() => {
  tasks = [{ ...task }];
  failingEndpoint = null;
  failureStatus = 500;
  mutationFailure = null;
  failRefreshAfterSave = false;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, "http://localhost").pathname;
    if (init?.method && init.method !== "GET") {
      if (mutationFailure === "network") throw new TypeError("Failed to fetch");
      if (mutationFailure === "http") return failure();
      if (init.method === "DELETE") {
        tasks = tasks.filter((item) => path !== `/api/tasks/${item.id}`);
        return Response.json({ success: true });
      }
      const body = JSON.parse(String(init.body));
      const saved = { ...task, ...body, id: init.method === "POST" ? "task-new" : "task-a" };
      if (init.method === "POST") tasks.push(saved);
      else tasks = tasks.map((item) => item.id === saved.id ? saved : item);
      if (failRefreshAfterSave) failingEndpoint = "/api/tasks";
      return Response.json({ data: saved });
    }
    if (path === failingEndpoint) return failure();
    if (path === "/api/tasks") {
      const params = new URL(url, "http://localhost").searchParams;
      const filtered = tasks.filter((item) => !params.has("status") || item.status === params.get("status"));
      return Response.json({ data: { data: filtered, pagination: { page: 1, limit: 100, total: filtered.length, totalPages: filtered.length ? 1 : 0 } } });
    }
    if (path === "/api/events") return Response.json({ data: [] });
    if (path === "/api/members") return Response.json({ data: [{ membershipId: "member-a", user: { name: "QA Admin" }, role: "ADMIN" }] });
    if (path === "/api/auth/me") return Response.json({ data: { membership: { role: "ADMIN" }, wedding: { brideName: "QA", groomName: "Partner", timeZone: "Asia/Kolkata" } } });
    if (path === "/api/dashboard") return Response.json({ data: { summary: { tasks: { total: tasks.length, completed: tasks.filter((item) => item.status === "COMPLETED").length, dueSoon: 0, assignedToCurrent: tasks.length } } } });
    throw new Error(`Unexpected test API request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mutationCalls = () => fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== "GET");
const waitForTasks = () => screen.findByRole("heading", { name: "Responsibilities in motion" });

describe("Tasks UI with injected API failures", () => {
  it.each(["/api/tasks", "/api/events", "/api/members", "/api/auth/me", "/api/dashboard"])("shows a load error and retries when %s fails", async (endpoint) => {
    failingEndpoint = endpoint;
    render(<TasksPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("The task request failed.");
    expect(screen.queryByRole("heading", { name: "Responsibilities in motion" })).toBeNull();
    failingEndpoint = null;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitForTasks();
    expect(screen.getByRole("heading", { name: task.title })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([403, 404])("keeps HTTP %s load failures on the retry screen instead of redirecting to onboarding", async (status) => {
    failingEndpoint = "/api/tasks";
    failureStatus = status;
    render(<TasksPage />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "We couldn't open your checklist." })).toBeTruthy();
  });

  it.each([400, 401, 403, 404, 409, 500])("retains the task draft and permits an explicit retry after HTTP %s", async (status) => {
    render(<TasksPage />);
    await waitForTasks();
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Task title/ }), { target: { value: "Keep my draft" } });
    mutationFailure = "http";
    failureStatus = status;
    fireEvent.click(screen.getByRole("button", { name: /Create task/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("The task request failed.");
    expect((screen.getByRole("textbox", { name: /Task title/ }) as HTMLInputElement).value).toBe("Keep my draft");
    expect(mutationCalls()).toHaveLength(1);
    if (status === 401) expect(screen.getByRole("link", { name: "Sign in again" }).getAttribute("target")).toBe("_blank");
    mutationFailure = null;
    fireEvent.click(screen.getByRole("button", { name: /Create task/ }));
    expect(await screen.findByRole("heading", { name: "Keep my draft" })).toBeTruthy();
    expect(mutationCalls()).toHaveLength(2);
  });

  it("retains an edited task's details after a network failure", async () => {
    render(<TasksPage />);
    await waitForTasks();
    fireEvent.click(screen.getByRole("button", { name: `Edit ${task.title}` }));
    fireEvent.change(screen.getByRole("textbox", { name: /Scope & instructions/ }), { target: { value: "My unsaved instructions" } });
    mutationFailure = "network";
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Check your connection");
    expect((screen.getByRole("textbox", { name: /Scope & instructions/ }) as HTMLTextAreaElement).value).toBe("My unsaved instructions");
    expect(mutationCalls()).toHaveLength(1);
  });

  it("shows a retry after a successful create followed by a failed refresh, without creating twice", async () => {
    tasks = [];
    render(<TasksPage />);
    await waitForTasks();
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Task title/ }), { target: { value: "Saved once" } });
    failRefreshAfterSave = true;
    fireEvent.click(screen.getByRole("button", { name: /Create task/ }));
    expect(await screen.findByText("Task added to your checklist.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("The task request failed.");
    expect(screen.queryByRole("textbox", { name: /Task title/ })).toBeNull();
    expect(mutationCalls()).toHaveLength(1);
    failingEndpoint = null;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Saved once" })).toBeTruthy();
    expect(mutationCalls()).toHaveLength(1);
  });

  it("keeps task status unchanged after a failed completion and updates it on retry", async () => {
    render(<TasksPage />);
    await waitForTasks();
    mutationFailure = "http";
    fireEvent.click(screen.getByRole("button", { name: `Complete ${task.title}` }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: `Complete ${task.title}` })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Completed (0)" })).toBeTruthy();
    mutationFailure = null;
    fireEvent.click(screen.getByRole("button", { name: `Complete ${task.title}` }));
    expect(await screen.findByRole("button", { name: `Reopen ${task.title}` })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Completed (1)" })).toBeTruthy();
  });

  it("retains a task after a failed deletion and permits a fresh confirmed retry", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TasksPage />);
    await waitForTasks();
    mutationFailure = "http";
    fireEvent.click(screen.getByRole("button", { name: `Delete ${task.title}` }));
    await screen.findByRole("alert");
    expect(screen.getByRole("heading", { name: task.title })).toBeTruthy();
    mutationFailure = null;
    fireEvent.click(screen.getByRole("button", { name: `Delete ${task.title}` }));
    await screen.findByText("Task deleted.");
    await waitFor(() => expect(screen.queryByRole("heading", { name: task.title })).toBeNull());
    expect(tasks).toHaveLength(0);
    expect(mutationCalls()).toHaveLength(2);
  });
});
