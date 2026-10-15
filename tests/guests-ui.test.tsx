// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GuestsPage from "@/app/guests/page";
import type { Guest } from "@/shared/guests/types";

vi.mock("@/app/workspace/WorkspaceSidebar", () => ({ WorkspaceSidebar: () => <aside>Workspace navigation</aside> }));
const guest: Guest = {
  id: "guest-a", name: "Rajesh & family", email: "rajesh@example.test", phone: null, maxGuests: 4,
  invitedEventIds: [], invitedEvents: [], notes: "Private instructions", rsvpStatus: "PENDING", attendingCount: null,
  invitationSentAt: null, lastReminderSentAt: null, reminderCount: 0, rsvpUpdatedAt: null,
  createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z",
};
let guests: Guest[];
let failingEndpoint: string | null;
let mutationStatus: number | null;
let failRefresh: boolean;
let userId: string;
let fetchMock: ReturnType<typeof vi.fn>;
const failed = (status = 500) => Response.json({ error: { code: "TEST_FAILURE", message: "Please retry this guest request." } }, { status });
beforeEach(() => {
  guests = [{ ...guest }]; failingEndpoint = null; mutationStatus = null; failRefresh = false; userId = "user-a";
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, "http://localhost").pathname;
    if (init?.method && init.method !== "GET") {
      if (mutationStatus) return failed(mutationStatus);
      if (init.method === "DELETE") { guests = []; return Response.json({ success: true }); }
      const input = JSON.parse(String(init.body));
      const saved = { ...guest, ...input, id: init.method === "POST" ? "guest-new" : guest.id };
      if (init.method === "POST") guests.push(saved); else guests = [saved];
      if (failRefresh) failingEndpoint = "/api/guests";
      return Response.json({ data: saved });
    }
    if (path === failingEndpoint) return failed();
    if (path === "/api/auth/me") return Response.json({ data: { user: { id: userId }, membership: { weddingId: "wedding-a", role: "ADMIN" }, wedding: { brideName: "Meera", groomName: "Aarav", timeZone: "Asia/Kolkata" } } });
    if (path === "/api/events") return Response.json({ data: [] });
    if (path === "/api/guests/rsvp-summary") return Response.json({ data: { totalGuests: guests.length, totalGuestCapacity: guests.reduce((sum, guest) => sum + guest.maxGuests, 0), pendingInvitations: guests.length, attendingInvitations: 0, notAttendingInvitations: 0, totalPeopleAttending: 0 } });
    if (path === "/api/guests") return Response.json({ data: guests, pagination: { page: 1, limit: 20, total: guests.length, totalPages: guests.length ? 1 : 0 } });
    throw new Error(`Unexpected guest test endpoint: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const ready = () => screen.findByRole("button", { name: guest.name });
const writes = () => fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== "GET");
async function add() {
  fireEvent.click(screen.getByRole("button", { name: "Add guest" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByRole("textbox", { name: /Guest \/ group name/ }), { target: { value: "New family" } });
  return dialog;
}
function action(name: string) {
  fireEvent.click(screen.getByLabelText(`Actions for ${guest.name}`));
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("Guest workspace interactions and recovery", () => {
  it.each(["View details", "Edit guest", "Delete invitation"])("closes the action menu when selecting %s", async (name) => {
    render(<GuestsPage />); await ready();
    const trigger = screen.getByLabelText(`Actions for ${guest.name}`);
    const menu = trigger.closest("details")!;
    fireEvent.click(trigger);
    expect(menu.open).toBe(true);
    // Include an icon click to cover descendants of the action button.
    const button = within(menu).getByRole("button", { name });
    fireEvent.click(button.querySelector("span")!);
    expect(menu.open).toBe(false);
    expect(await screen.findByRole(name === "Delete invitation" ? "alertdialog" : "dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close guest dialog" }));
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(writes()).toHaveLength(0);
  });
  it("dismisses the action menu on outside clicks without blocking the clicked action", async () => {
    render(<GuestsPage />); await ready();
    const trigger = screen.getByLabelText(`Actions for ${guest.name}`);
    const menu = trigger.closest("details")!;
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("heading", { name: "Guests & RSVP" }));
    expect(menu.open).toBe(false);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Add guest" }));
    expect(menu.open).toBe(false);
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
  it("dismisses on Escape and returns focus to the action trigger", async () => {
    render(<GuestsPage />); await ready();
    const trigger = screen.getByLabelText(`Actions for ${guest.name}`);
    const menu = trigger.closest("details")!;
    fireEvent.click(trigger);
    within(menu).getByRole("button", { name: "Edit guest" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("closes the previous row menu when another guest's menu is opened", async () => {
    guests.push({ ...guest, id: "guest-b", name: "Another family" });
    render(<GuestsPage />); await ready();
    const first = screen.getByLabelText(`Actions for ${guest.name}`);
    const second = screen.getByLabelText("Actions for Another family");
    fireEvent.click(first);
    fireEvent.click(second);
    expect(first.closest("details")!.open).toBe(false);
    expect(second.closest("details")!.open).toBe(true);
    fireEvent.click(second);
    expect(second.closest("details")!.open).toBe(false);
  });
  it("dismisses when keyboard focus leaves the action menu", async () => {
    render(<GuestsPage />); await ready();
    const trigger = screen.getByLabelText(`Actions for ${guest.name}`);
    fireEvent.click(trigger);
    within(trigger.closest("details")!).getByRole("button", { name: "View details" }).focus();
    expect(trigger.closest("details")!.open).toBe(true);
    screen.getByRole("textbox", { name: "Search guests" }).focus();
    expect(trigger.closest("details")!.open).toBe(false);
  });
  it("shows real group counts and read-only RSVP without unsupported delivery actions", async () => {
    render(<GuestsPage />); await ready();
    expect(screen.getByRole("region", { name: "Guest summary" }).textContent).toContain("4 maximum guest capacity");
    expect(screen.queryByRole("button", { name: /Send reminder|Copy link|Export/ })).toBeNull();
    expect(screen.getByText(/Guests RSVP without creating an account/)).toBeTruthy();
  });
  it.each(["/api/guests", "/api/events", "/api/guests/rsvp-summary", "/api/auth/me"])("recovers from %s load failure without displaying fake empty data", async (endpoint) => {
    failingEndpoint = endpoint; render(<GuestsPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("Please retry");
    expect(screen.queryByText("Make room for your wedding circle.")).toBeNull();
    failingEndpoint = null; fireEvent.click(screen.getByRole("button", { name: "Refresh list" })); await ready();
  });
  it("adds a group with no email, phone or events", async () => {
    render(<GuestsPage />); await ready(); const dialog = await add();
    expect(dialog.getByText(/No events yet/)).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Add guest" }));
    expect(await screen.findByRole("button", { name: "New family" })).toBeTruthy();
    expect(JSON.parse(writes()[0]?.[1]?.body as string)).toMatchObject({ name: "New family", maxGuests: 1, email: "", phone: "", invitedEventIds: [] });
    expect(writes()).toHaveLength(1);
  });
  it("validates whitespace and invalid party size before any write", async () => {
    render(<GuestsPage />); await ready(); const dialog = await add();
    fireEvent.change(dialog.getByRole("textbox", { name: /Guest \/ group name/ }), { target: { value: " " } });
    fireEvent.change(dialog.getByRole("spinbutton", { name: /Maximum party size/ }), { target: { value: "0" } });
    fireEvent.click(dialog.getByRole("button", { name: "Add guest" }));
    expect(await dialog.findByText("Enter a guest or group name.")).toBeTruthy(); expect(writes()).toHaveLength(0);
  });
  it.each([400, 401, 403, 409, 500])("preserves the draft after HTTP %s without automatic write retries", async (status) => {
    render(<GuestsPage />); await ready(); const dialog = await add(); mutationStatus = status;
    fireEvent.click(dialog.getByRole("button", { name: "Add guest" }));
    expect((await dialog.findByRole("alert")).textContent).toContain("Please retry");
    expect((dialog.getByRole("textbox", { name: /Guest \/ group name/ }) as HTMLInputElement).value).toBe("New family"); expect(writes()).toHaveLength(1);
    if (status === 401) expect(dialog.getByRole("link", { name: "Sign in again" }).getAttribute("target")).toBe("_blank");
    mutationStatus = null; fireEvent.click(dialog.getByRole("button", { name: "Add guest" }));
    expect(await screen.findByRole("button", { name: "New family" })).toBeTruthy(); expect(writes()).toHaveLength(2);
  });
  it("does not save twice when a successful write is followed by a refresh failure", async () => {
    render(<GuestsPage />); await ready(); const dialog = await add(); failRefresh = true;
    fireEvent.click(dialog.getByRole("button", { name: "Add guest" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Please retry");
    expect(screen.getByRole("status").textContent).toContain("Guest invitation group added.");
    expect(screen.queryByRole("dialog")).toBeNull(); expect(writes()).toHaveLength(1);
    failingEndpoint = null; fireEvent.click(screen.getByRole("button", { name: "Refresh list" }));
    expect(await screen.findByRole("button", { name: "New family" })).toBeTruthy(); expect(writes()).toHaveLength(1);
  });
  it("prefills editing and confirms before discarding a draft", async () => {
    render(<GuestsPage />); await ready(); action("Edit guest");
    const dialog = within(await screen.findByRole("dialog"));
    expect((dialog.getByRole("textbox", { name: /Internal notes/ }) as HTMLTextAreaElement).value).toBe(guest.notes);
    fireEvent.change(dialog.getByRole("textbox", { name: /Internal notes/ }), { target: { value: "Unsaved private notes" } });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(await dialog.findByText("Discard your unsaved changes?")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    fireEvent.click(dialog.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(writes()).toHaveLength(0);
  });
  it("requires explicit deletion confirmation and honors Cancel", async () => {
    render(<GuestsPage />); await ready(); action("Delete invitation");
    let dialog = within(await screen.findByRole("alertdialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" })); expect(writes()).toHaveLength(0);
    action("Delete invitation"); dialog = within(await screen.findByRole("alertdialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Delete invitation" }));
    expect(await screen.findByRole("heading", { name: "Make room for your wedding circle." })).toBeTruthy(); expect(writes()).toHaveLength(1);
  });
  it("uses server-side search and combined filters", async () => {
    render(<GuestsPage />); await ready();
    fireEvent.change(screen.getByRole("textbox", { name: "Search guests" }), { target: { value: "family" } });
    fireEvent.change(screen.getByRole("combobox", { name: "RSVP status" }), { target: { value: "PENDING" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("search=family") && String(url).includes("rsvpStatus=PENDING"))).toBe(true));
  });
  it("prevents a draft from being submitted under a changed account", async () => {
    render(<GuestsPage />); await ready(); const dialog = await add(); userId = "different-user";
    fireEvent.click(dialog.getByRole("button", { name: "Add guest" }));
    expect((await screen.findByRole("alert")).textContent).toContain("account or wedding changed");
    expect(writes()).toHaveLength(0); expect(screen.queryByRole("dialog")).toBeNull();
  });
});
