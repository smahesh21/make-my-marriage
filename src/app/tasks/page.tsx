"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { WorkspaceSidebar } from "@/app/workspace/WorkspaceSidebar";
import { dateTimeInputToIso, toDateInputValue } from "@/shared/events/time";
import { type TaskPriority, type TaskStatus } from "@/shared/tasks/schemas";

type Task = {
  id: string;
  title: string;
  description: string | null;
  assignedMembershipId: string | null;
  eventId: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { membershipId: string; name: string; role: "ADMIN" | "MANAGER" } | null;
  event: { id: string; name: string; archivedAt: string | null } | null;
};

type Member = {
  membershipId: string;
  user: { name: string };
  role: "ADMIN" | "MANAGER";
};

type EventOption = { id: string; name: string };
type ApiError = { code?: string; message?: string; fields?: Record<string, string[] | undefined> };
type TaskPagination = { page: number; limit: number; total: number; totalPages: number };
type TaskTab = "all" | "mine" | "completed";
type TaskFilter = "ALL" | TaskStatus;

type TaskForm = {
  title: string;
  description: string;
  assignedMembershipId: string;
  eventId: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
};

type DashboardSummary = {
  total: number;
  completed: number;
  dueSoon: number;
  assignedToCurrent: number;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const defaultForm: TaskForm = {
  title: "",
  description: "",
  assignedMembershipId: "",
  eventId: "",
  dueDate: "",
  priority: "MEDIUM",
  status: "TODO",
};

function formatDueDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone }).format(new Date(value));
}

function localToday(timeZone: string) {
  return toDateInputValue(new Date().toISOString(), timeZone);
}

function isOverdue(task: Task, timeZone: string) {
  return task.status !== "COMPLETED" && Boolean(task.dueDate && toDateInputValue(task.dueDate, timeZone) < localToday(timeZone));
}

function TasksLoadingState() {
  return (
    <main className="workspace-page tasks-page--loading" aria-busy="true">
      <aside className="members-sidebar members-sidebar--skeleton" aria-hidden="true"><span className="members-skeleton members-skeleton--brand" /><span className="members-skeleton" /><span className="members-skeleton" /><span className="members-skeleton" /></aside>
      <section className="tasks-loading" aria-live="polite" role="status">
        <div className="tasks-loading__header"><span className="members-skeleton members-skeleton--eyebrow" /><span className="members-skeleton members-skeleton--title" /><span className="members-skeleton members-skeleton--copy" /></div>
        <div className="tasks-loading__metrics"><span /><span /><span /></div>
        <div className="tasks-loading__panel"><span className="members-skeleton members-skeleton--panel-title" /><span className="members-skeleton members-skeleton--row" /><span className="members-skeleton members-skeleton--row" /><span className="members-skeleton members-skeleton--row" /></div>
        <span className="members-loading__message">Opening your shared checklist…</span>
      </section>
    </main>
  );
}

function TasksLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="workspace-page tasks-page--loading">
      <section className="members-load-error" role="alert" aria-live="assertive">
        <span className="member-invite-icon member-invite-icon--error"><span className="material-symbols-outlined" aria-hidden="true">cloud_off</span></span>
        <span className="section-eyebrow">Tasks &amp; checklist</span>
        <h1>We couldn&apos;t open your checklist.</h1>
        <p>{message}</p>
        <button className="button" onClick={onRetry} type="button">Try again</button>
      </section>
    </main>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [weddingName, setWeddingName] = useState("Your wedding workspace");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [currentRole, setCurrentRole] = useState<"ADMIN" | "MANAGER" | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary>({ total: 0, completed: 0, dueSoon: 0, assignedToCurrent: 0 });
  const [pagination, setPagination] = useState<TaskPagination>({ page: 1, limit: 100, total: 0, totalPages: 0 });
  const [tab, setTab] = useState<TaskTab>("all");
  const [statusFilter, setStatusFilter] = useState<TaskFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "ALL">("ALL");
  const [eventFilter, setEventFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "100" });
      if (tab === "mine") params.set("mine", "true");
      if (tab === "completed") params.set("status", "COMPLETED");
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (eventFilter !== "all") params.set("eventId", eventFilter);
      if (assigneeFilter !== "all") params.set("assignedMembershipId", assigneeFilter);

      const [taskResponse, eventResponse, memberResponse, authResponse, dashboardResponse] = await Promise.all([
        fetch(`/api/tasks?${params.toString()}`),
        fetch("/api/events"),
        fetch("/api/members"),
        fetch("/api/auth/me"),
        fetch("/api/dashboard"),
      ]);
      const taskPayload = (await taskResponse.json()) as { data?: { data?: Task[]; pagination?: TaskPagination }; error?: ApiError };
      const eventPayload = (await eventResponse.json()) as { data?: Array<{ id: string; name: string }>; error?: ApiError };
      const memberPayload = (await memberResponse.json()) as { data?: Member[]; error?: ApiError };
      const authPayload = (await authResponse.json()) as { data?: { membership?: { role: "ADMIN" | "MANAGER" } | null; wedding?: { brideName: string; groomName: string; timeZone: string } | null }; error?: ApiError };
      const dashboardPayload = (await dashboardResponse.json()) as { data?: { summary?: { tasks?: Partial<DashboardSummary> } }; error?: ApiError };

      if ([taskResponse, authResponse].some((response) => response.status === 401)) {
        window.location.href = "/login";
        return;
      }
      if (taskResponse.status === 404 || authPayload.data?.membership === null) {
        window.location.href = "/onboarding";
        return;
      }
      if (!taskResponse.ok) throw new Error(taskPayload.error?.message ?? "Unable to load your tasks.");
      if (!eventResponse.ok) throw new Error(eventPayload.error?.message ?? "Unable to load your wedding events.");
      if (!memberResponse.ok) throw new Error(memberPayload.error?.message ?? "Unable to load wedding members.");

      const taskData = taskPayload.data?.data ?? [];
      const taskPagination = taskPayload.data?.pagination ?? { page, limit: 100, total: 0, totalPages: 0 };
      setTasks(taskData);
      setPagination(taskPagination);
      setEvents(eventPayload.data ?? []);
      setMembers(memberPayload.data ?? []);
      const wedding = authPayload.data?.wedding;
      if (wedding) {
        setWeddingName(`${wedding.brideName} & ${wedding.groomName}`);
        setTimeZone(wedding.timeZone);
      }
      setCurrentRole(authPayload.data?.membership?.role ?? null);
      const taskSummary = dashboardPayload.data?.summary?.tasks;
      setDashboardSummary({
        total: taskSummary?.total ?? taskPagination.total,
        completed: taskSummary?.completed ?? 0,
        dueSoon: taskSummary?.dueSoon ?? 0,
        assignedToCurrent: taskSummary?.assignedToCurrent ?? 0,
      });
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your tasks.");
    } finally {
      setIsLoading(false);
    }
  }, [assigneeFilter, eventFilter, page, priorityFilter, statusFilter, tab]);

  useEffect(() => { void loadData(); }, [loadData]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => [task.title, task.description ?? "", task.assignee?.name ?? "", task.event?.name ?? ""].some((value) => value.toLowerCase().includes(query)));
  }, [search, tasks]);

  function openCreate() {
    setEditingTask(null);
    setForm(defaultForm);
    setError(null);
    setNotice(null);
    setIsDrawerOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      assignedMembershipId: task.assignedMembershipId ?? "",
      eventId: task.eventId ?? "",
      dueDate: task.dueDate ? toDateInputValue(task.dueDate, timeZone) : "",
      priority: task.priority,
      status: task.status,
    });
    setError(null);
    setNotice(null);
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    if (isSubmitting) return;
    setIsDrawerOpen(false);
    setEditingTask(null);
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      const body = {
        title: form.title,
        description: form.description,
        assignedMembershipId: form.assignedMembershipId || null,
        eventId: form.eventId || null,
        dueDate: form.dueDate ? dateTimeInputToIso(form.dueDate, "00:00", timeZone) : null,
        priority: form.priority,
        status: form.status,
      };
      const response = await fetch(editingTask ? `/api/tasks/${editingTask.id}` : "/api/tasks", {
        method: editingTask ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { data?: Task; error?: ApiError };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Unable to save this task.");
      setNotice(editingTask ? "Task details updated." : "Task added to your checklist.");
      setIsDrawerOpen(false);
      setEditingTask(null);
      await loadData();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this task.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleTask(task: Task) {
    setActingId(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: task.status === "COMPLETED" ? "TODO" : "COMPLETED" }),
      });
      const payload = (await response.json()) as { error?: ApiError };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to update this task.");
      setNotice(task.status === "COMPLETED" ? "Task reopened." : "Task marked complete.");
      await loadData();
    } catch (toggleError: unknown) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update this task.");
    } finally {
      setActingId(null);
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    setActingId(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: ApiError };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to delete this task.");
      setNotice("Task deleted.");
      await loadData();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this task.");
    } finally {
      setActingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setEventFilter("all");
    setAssigneeFilter("all");
    setTab("all");
    setPage(1);
  }

  if (isLoading) return <TasksLoadingState />;
  if (error && tasks.length === 0 && !isDrawerOpen) return <TasksLoadError message={error} onRetry={() => void loadData()} />;

  const openTasks = Math.max(0, dashboardSummary.total - dashboardSummary.completed);
  const completionRate = dashboardSummary.total > 0 ? Math.round((dashboardSummary.completed / dashboardSummary.total) * 100) : 0;

  return (
    <main className="workspace-page tasks-page">
      <WorkspaceSidebar active="tasks" />
      <section className="tasks-content">
        <header className="workspace-topbar"><div><span className="section-eyebrow">{currentRole ?? "Member"} workspace</span><p>Turn the many details into a shared rhythm.</p></div><Link className="text-button" href="/settings/wedding">Wedding details</Link></header>
        <div className="tasks-shell">
          <nav className="tasks-breadcrumb" aria-label="Breadcrumb"><Link href="/dashboard">Workspace</Link><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span><span>{weddingName}</span><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span><strong>Tasks &amp; checklist</strong></nav>
          <header className="tasks-hero"><div className="tasks-hero__copy"><span className="section-eyebrow">The shared ceremony ledger</span><h1>Tasks &amp; checklist</h1><p>Organize responsibilities, deadlines, and ceremonial work in one calm, shared place across your wedding circle.</p></div><div className="tasks-hero__actions"><button className="button button--quiet tasks-secondary-action" onClick={() => window.print()} type="button"><span className="material-symbols-outlined" aria-hidden="true">print</span>Print view</button><button className="button tasks-primary-action" onClick={openCreate} type="button"><span className="material-symbols-outlined" aria-hidden="true">add</span>Add task</button></div></header>

          {error ? <div className="members-alert form-error" role="alert">{error}</div> : null}
          {notice ? <div className="members-alert form-success" role="status">{notice}</div> : null}

          <section className="tasks-metrics" aria-label="Task summary">
            <article><div className="tasks-metric__top"><span>Open tasks</span><span className="material-symbols-outlined" aria-hidden="true">checklist_rtl</span></div><div className="tasks-metric__value"><strong>{openTasks}</strong><span>active ceremony duties</span></div><div className="tasks-metric__detail">{dashboardSummary.assignedToCurrent} assigned to you</div></article>
            <article><div className="tasks-metric__top"><span>Due soon</span><span className="tasks-metric__badge">Next 7 days</span></div><div className="tasks-metric__value"><strong>{dashboardSummary.dueSoon}</strong><span>urgent deadlines</span></div><div className="tasks-metric__detail"><span className="tasks-metric__dot" />Keep the next moments close at hand</div></article>
            <article><div className="tasks-metric__top"><span>Completed</span><strong className="tasks-metric__rate">{completionRate}% settled</strong></div><div className="tasks-metric__value"><strong>{dashboardSummary.completed}</strong><span>of {dashboardSummary.total} total items closed</span></div><div className="tasks-progress"><span style={{ width: `${completionRate}%` }} /></div></article>
          </section>

          <section className="tasks-toolbar" aria-label="Task filters">
            <div className="tasks-tabs" role="tablist" aria-label="Task views">
              <button className={tab === "all" ? "is-active" : ""} onClick={() => { setTab("all"); setPage(1); }} role="tab" aria-selected={tab === "all"} type="button">All tasks ({dashboardSummary.total})</button>
              <button className={tab === "mine" ? "is-active" : ""} onClick={() => { setTab("mine"); setPage(1); }} role="tab" aria-selected={tab === "mine"} type="button">My tasks ({dashboardSummary.assignedToCurrent})</button>
              <button className={tab === "completed" ? "is-active" : ""} onClick={() => { setTab("completed"); setPage(1); }} role="tab" aria-selected={tab === "completed"} type="button">Completed ({dashboardSummary.completed})</button>
            </div>
            <div className="tasks-toolbar__controls">
              <label className="tasks-search"><span className="material-symbols-outlined" aria-hidden="true">search</span><span className="sr-only">Search tasks</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks, people, or ceremonies" value={search} /></label>
              <label className="tasks-filter"><span className="sr-only">Filter by status</span><select onChange={(event) => { setStatusFilter(event.target.value as TaskFilter); setPage(1); }} value={statusFilter}><option value="ALL">All status</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="tasks-filter"><span className="sr-only">Filter by priority</span><select onChange={(event) => { setPriorityFilter(event.target.value as TaskPriority | "ALL"); setPage(1); }} value={priorityFilter}><option value="ALL">All priority</option>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="tasks-filter"><span className="sr-only">Filter by ceremony</span><select onChange={(event) => { setEventFilter(event.target.value); setPage(1); }} value={eventFilter}><option value="all">All ceremonies</option><option value="none">General wedding</option>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
              <label className="tasks-filter"><span className="sr-only">Filter by assignee</span><select onChange={(event) => { setAssigneeFilter(event.target.value); setPage(1); }} value={assigneeFilter}><option value="all">All members</option><option value="none">Unassigned</option>{members.map((member) => <option key={member.membershipId} value={member.membershipId}>{member.user.name}</option>)}</select></label>
            </div>
          </section>

          <section className="tasks-list-panel" aria-labelledby="task-list-title">
            <header className="tasks-list-panel__header"><div><span className="section-eyebrow">Your wedding circle</span><h2 id="task-list-title">Responsibilities in motion</h2></div><span className="tasks-list-panel__count">Showing {visibleTasks.length} of {pagination.total} tasks</span></header>
            {visibleTasks.length === 0 ? <div className="tasks-empty"><span className="tasks-empty__mark"><span className="material-symbols-outlined" aria-hidden="true">playlist_add_check</span></span><div><h3>{tasks.length > 0 ? "No tasks match these filters." : "Begin your shared checklist."}</h3><p>{tasks.length > 0 ? "Try another view or clear the filters to see more responsibilities." : "Add the practical details that will help your family move from one beautiful moment to the next."}</p><button className="button" onClick={tasks.length > 0 ? clearFilters : openCreate} type="button">{tasks.length > 0 ? "Clear filters" : "Add your first task"}</button></div></div> : <div className="tasks-list">{visibleTasks.map((task) => <article className={`task-row ${task.status === "COMPLETED" ? "is-completed" : ""}`} key={task.id}><button aria-label={task.status === "COMPLETED" ? `Reopen ${task.title}` : `Complete ${task.title}`} className={`task-checkbox ${task.status === "COMPLETED" ? "is-checked" : ""}`} disabled={actingId === task.id} onClick={() => void toggleTask(task)} type="button"><span className="material-symbols-outlined" aria-hidden="true">{task.status === "COMPLETED" ? "check" : ""}</span></button><div className="task-row__main"><div className="task-row__title-line"><h3>{task.title}</h3><span className={`task-priority task-priority--${task.priority.toLowerCase()}`}>{PRIORITY_LABELS[task.priority]}</span></div>{task.description ? <p>{task.description}</p> : null}<div className="task-row__meta"><span><span className="material-symbols-outlined" aria-hidden="true">{task.assignee ? "person" : "person_off"}</span>{task.assignee?.name ?? (task.assignedMembershipId ? "Former member" : "Unassigned")}</span><span><span className="material-symbols-outlined" aria-hidden="true">event</span>{task.event?.name ?? (task.eventId ? "Former event" : "General wedding")}</span>{task.dueDate ? <span className={isOverdue(task, timeZone) ? "is-overdue" : ""}><span className="material-symbols-outlined" aria-hidden="true">calendar_today</span>{task.status === "COMPLETED" ? `Completed ${formatDueDate(task.completedAt ?? task.dueDate, timeZone)}` : isOverdue(task, timeZone) ? `Overdue · ${formatDueDate(task.dueDate, timeZone)}` : `Due ${formatDueDate(task.dueDate, timeZone)}`}</span> : <span><span className="material-symbols-outlined" aria-hidden="true">event_busy</span>No deadline</span>}</div></div><div className="task-row__status"><span className={`task-status task-status--${task.status.toLowerCase()}`}>{STATUS_LABELS[task.status]}</span><button aria-label={`Edit ${task.title}`} className="icon-button" onClick={() => openEdit(task)} type="button"><span className="material-symbols-outlined" aria-hidden="true">edit</span></button><button aria-label={`Delete ${task.title}`} className="icon-button icon-button--muted" disabled={actingId === task.id} onClick={() => void deleteTask(task)} type="button"><span className="material-symbols-outlined" aria-hidden="true">delete</span></button></div></article>)}</div>}
            {pagination.totalPages > 1 ? <footer className="tasks-pagination"><button className="button button--quiet" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button className="button button--quiet" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} type="button">Next</button></footer> : null}
          </section>
        </div>
      </section>

      {isDrawerOpen ? <div className="tasks-drawer-layer"><button className="tasks-drawer-backdrop" aria-label="Close task form" onClick={closeDrawer} type="button" /><aside className="tasks-drawer" aria-labelledby="task-form-title"><header className="tasks-drawer__header"><div><span className="section-eyebrow">{editingTask ? "Edit checklist item" : "New responsibility"}</span><h2 id="task-form-title">{editingTask ? "Refine task details" : "Add a new task"}</h2><p>Assign the next thoughtful action to someone in your wedding circle.</p></div><button className="icon-button" aria-label="Close task form" onClick={closeDrawer} type="button"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></header><form className="tasks-form" onSubmit={submitTask}><label className="field">Task title <strong aria-hidden="true">*</strong><input autoFocus maxLength={200} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Enter a descriptive ceremony title…" required value={form.title} /></label><label className="field">Scope &amp; instructions <em>optional</em><textarea maxLength={2000} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Add vendor notes, contact details, or checklist nuances…" rows={4} value={form.description} /></label><div className="form-grid"><label className="field">Assignee <em>optional</em><select onChange={(event) => setForm((current) => ({ ...current, assignedMembershipId: event.target.value }))} value={form.assignedMembershipId}><option value="">Unassigned</option>{members.map((member) => <option key={member.membershipId} value={member.membershipId}>{member.user.name} · {member.role === "ADMIN" ? "Admin" : "Manager"}</option>)}</select></label><label className="field">Related ceremony <em>optional</em><select onChange={(event) => setForm((current) => ({ ...current, eventId: event.target.value }))} value={form.eventId}><option value="">General wedding</option>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label></div><label className="field">Target deadline <em>optional</em><input onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} type="date" value={form.dueDate} /><span className="field-help">Use the wedding timezone: {timeZone}.</span></label><fieldset className="tasks-form__fieldset"><legend>Priority level</legend><div className="tasks-priority-options">{Object.entries(PRIORITY_LABELS).map(([value, label]) => <button className={form.priority === value ? `is-selected tasks-priority-option tasks-priority-option--${value.toLowerCase()}` : "tasks-priority-option"} key={value} onClick={() => setForm((current) => ({ ...current, priority: value as TaskPriority }))} type="button">{label}</button>)}</div></fieldset><fieldset className="tasks-form__fieldset"><legend>Status</legend><div className="tasks-status-options">{Object.entries(STATUS_LABELS).map(([value, label]) => <label key={value}><input checked={form.status === value} name="task-status" onChange={() => setForm((current) => ({ ...current, status: value as TaskStatus }))} type="radio" value={value} /><span>{label}</span></label>)}</div></fieldset>{error ? <p className="form-error" role="alert">{error}</p> : null}<footer className="tasks-drawer__footer"><button className="button button--quiet" disabled={isSubmitting} onClick={closeDrawer} type="button">Cancel</button><button className="button" disabled={isSubmitting} type="submit"><span className="material-symbols-outlined" aria-hidden="true">add_task</span>{isSubmitting ? "Saving…" : editingTask ? "Save changes" : "Create task"}</button></footer></form></aside></div> : null}
    </main>
  );
}
