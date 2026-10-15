// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicInvitationPage } from "@/app/invite/[token]/PublicInvitationPage";
import { GuestInvitationActions } from "@/app/guests/GuestInvitationActions";
import type { PublicInvitation } from "@/shared/guests/invitations";
import type { Guest } from "@/shared/guests/types";

const token = "t".repeat(43);
const fixture: PublicInvitation = {
  guest: {
    name: "Rajesh & family",
    maxGuests: 4,
    rsvpStatus: "PENDING",
    attendingCount: null,
  },
  wedding: {
    brideName: "Meera",
    groomName: "Aarav",
    weddingDate: "2027-02-14",
    timeZone: "Asia/Kolkata",
    title: null,
    location: "Udaipur",
    welcomeMessage: null,
  },
  events: [
    {
      name: "Pheras",
      startsAt: "2027-02-14T04:00:00Z",
      endsAt: null,
      venueName: "Main mandap",
      address: "Test road",
      dressCode: "Traditional",
      description: null,
    },
  ],
};
const guest: Guest = {
  id: "guest-a",
  name: "Rajesh & family",
  email: "rajesh@example.test",
  phone: null,
  maxGuests: 4,
  invitedEventIds: [],
  invitedEvents: [],
  notes: null,
  rsvpStatus: "PENDING",
  attendingCount: null,
  invitationSentAt: null,
  lastReminderSentAt: null,
  reminderCount: 0,
  rsvpUpdatedAt: null,
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
};
let data: PublicInvitation;
let loadFailure: number | null;
let writeFailure: number | null;
let conflictCapacity: number | null;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  data = structuredClone(fixture);
  loadFailure = null;
  writeFailure = null;
  conflictCapacity = null;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      if (writeFailure) {
        if (conflictCapacity !== null) data.guest.maxGuests = conflictCapacity;
        return Response.json(
          {
            error: {
              code:
                writeFailure === 400 ? "PARTY_SIZE_CHANGED" : "TEST_FAILURE",
              message: "Review the invitation and try again.",
            },
          },
          { status: writeFailure, headers: { "Retry-After": "2" } },
        );
      }
      const input = JSON.parse(String(init.body));
      data.guest.rsvpStatus = input.status;
      data.guest.attendingCount = input.attendingCount;
      return Response.json({
        data: { status: input.status, attendingCount: input.attendingCount },
      });
    }
    if (loadFailure)
      return Response.json(
        {
          error: {
            code: "TEST_FAILURE",
            message: "Unable to load. Try again.",
          },
        },
        { status: loadFailure },
      );
    return Response.json({ data });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const writes = () =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
const ready = () => screen.findByRole("heading", { name: "Meera & Aarav" });

describe("public invitation and RSVP", () => {
  it("shows only invitation details, has no account controls, and requires an explicit answer", async () => {
    render(<PublicInvitationPage token={token} />);
    await ready();
    expect(screen.getByRole("heading", { name: "Pheras" })).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /Sign in|Create account/ }),
    ).toBeNull();
    for (const radio of screen.getAllByRole("radio"))
      expect((radio as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Submit RSVP" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "whether your group will attend",
    );
    expect(writes()).toHaveLength(0);
  });
  it("submits a total party count and allows changing to Not Attending", async () => {
    render(<PublicInvitationPage token={token} />);
    await ready();
    fireEvent.click(screen.getByRole("radio", { name: "Yes, we'll be there" }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /How many people/ }),
      { target: { value: "3" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit RSVP" }));
    expect(
      await screen.findByRole("button", { name: "Change response" }),
    ).toBeTruthy();
    expect(screen.getByText(/3 people confirmed/)).toBeTruthy();
    expect(JSON.parse(writes()[0]![1]!.body as string)).toEqual({
      status: "ATTENDING",
      attendingCount: 3,
    });
    fireEvent.click(screen.getByRole("button", { name: "Change response" }));
    fireEvent.click(screen.getByRole("radio", { name: "No, we can't attend" }));
    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit RSVP" }));
    expect(await screen.findByText(/marked as Not Attending/)).toBeTruthy();
    expect(JSON.parse(writes()[1]![1]!.body as string)).toEqual({
      status: "NOT_ATTENDING",
      attendingCount: 0,
    });
    expect(screen.getByRole("heading", { name: "Pheras" })).toBeTruthy();
  });
  it("rejects party-size overflow before sending", async () => {
    render(<PublicInvitationPage token={token} />);
    await ready();
    fireEvent.click(screen.getByRole("radio", { name: "Yes, we'll be there" }));
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit RSVP" }));
    expect((await screen.findByRole("alert")).textContent).toContain("up to 4");
    expect(writes()).toHaveLength(0);
  });
  it.each([400, 409, 500])(
    "preserves draft choices after HTTP %s and refreshes changed limits",
    async (status) => {
      render(<PublicInvitationPage token={token} />);
      await ready();
      fireEvent.click(
        screen.getByRole("radio", { name: "Yes, we'll be there" }),
      );
      fireEvent.change(screen.getByRole("spinbutton"), {
        target: { value: "3" },
      });
      writeFailure = status;
      conflictCapacity = status === 500 ? null : 1;
      fireEvent.click(screen.getByRole("button", { name: "Submit RSVP" }));
      await screen.findByRole("alert");
      await waitFor(() =>
        expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(
          "3",
        ),
      );
      if (status !== 500)
        await screen.findByText("Includes the named guest. Maximum: 1.");
      expect(writes()).toHaveLength(1);
    },
  );
  it("uses Retry-After for too many submissions", async () => {
    render(<PublicInvitationPage token={token} />);
    await ready();
    writeFailure = 429;
    fireEvent.click(screen.getByRole("radio", { name: "No, we can't attend" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit RSVP" }));
    expect(await screen.findByText(/Please wait 2 seconds/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Submit RSVP" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("retries temporary load errors and shows generic unavailable links", async () => {
    loadFailure = 503;
    render(<PublicInvitationPage token={token} />);
    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeTruthy();
    loadFailure = null;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await ready();
    loadFailure = 404;
    fireEvent(window, new Event("focus"));
    expect(
      await screen.findByRole("heading", {
        name: "This invitation is unavailable.",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Pheras" })).toBeNull();
  });
  it("does not apply a late RSVP response to another household after the token changes", async () => {
    const view = render(<PublicInvitationPage token={token} />);
    await ready();
    fireEvent.click(screen.getByRole("radio", { name: "Yes, we'll be there" }));
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit RSVP" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    data.guest = {
      name: "Another household",
      maxGuests: 2,
      rsvpStatus: "PENDING",
      attendingCount: null,
    };
    view.rerender(<PublicInvitationPage token={"x".repeat(43)} />);
    await screen.findByRole("heading", { name: "Dear Another household," });
    await act(async () => {
      finish(
        Response.json({ data: { status: "ATTENDING", attendingCount: 1 } }),
      );
    });
    expect(
      screen.queryByRole("button", { name: "Change response" }),
    ).toBeNull();
    expect(screen.queryByText("Your RSVP has been saved.")).toBeNull();
    expect(
      (
        screen.getByRole("radio", {
          name: "Yes, we'll be there",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });
  it("shows malformed links as unavailable without calling the API", async () => {
    render(<PublicInvitationPage token="bad" />);
    expect(
      await screen.findByRole("heading", {
        name: "This invitation is unavailable.",
      }),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("supports RSVP before ceremonies are assigned and handles a single-person invitation", async () => {
    data.events = [];
    data.guest.maxGuests = 1;
    render(<PublicInvitationPage token={token} />);
    await ready();
    expect(screen.getByText(/organiser hasn't assigned/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Yes, we'll be there" }));
    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit RSVP" }));
    expect(
      await screen.findByRole("button", { name: "Change response" }),
    ).toBeTruthy();
  });
  it("does not resubmit a successful RSVP when refreshing its details fails", async () => {
    render(<PublicInvitationPage token={token} />);
    await ready();
    fireEvent.click(screen.getByRole("radio", { name: "No, we can't attend" }));
    loadFailure = 503;
    fireEvent.click(screen.getByRole("button", { name: "Submit RSVP" }));
    expect(
      await screen.findByRole("button", { name: "Refresh invitation" }),
    ).toBeTruthy();
    expect(screen.getByText("Your RSVP has been saved.")).toBeTruthy();
    loadFailure = null;
    fireEvent.click(screen.getByRole("button", { name: "Refresh invitation" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(writes()).toHaveLength(1);
  });
});

describe("private link sharing and email actions", () => {
  const checkOwner = vi.fn().mockResolvedValue(undefined);
  const onSent = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    checkOwner.mockClear();
    onSent.mockClear();
  });
  it("retrieves a stable URL and supplies manual-copy fallback without sending email", async () => {
    const url = `https://example.test/invite/${token}`;
    fetchMock.mockResolvedValue(Response.json({ data: { url } }));
    render(
      <GuestInvitationActions
        guest={guest}
        checkOwner={checkOwner}
        onSent={onSent}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Get invitation link" }),
    );
    expect(await screen.findByDisplayValue(url)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Select and copy",
    );
    expect(
      screen.getByRole("link", { name: "Open invitation" }).getAttribute("rel"),
    ).toContain("noreferrer");
    expect(
      screen
        .getByRole("link", { name: "Share in WhatsApp" })
        .getAttribute("href"),
    ).toContain("wa.me");
    expect(writes()).toHaveLength(0);
  });
  it.each([
    ["Send invitation email", "invitation", "send-invitation"],
    ["Send RSVP reminder", "reminder", "send-reminder"],
  ] as const)(
    "requires confirmation and sends JSON for %s",
    async (label, kind, endpoint) => {
      fetchMock.mockResolvedValue(Response.json({ success: true }));
      render(
        <GuestInvitationActions
          guest={guest}
          checkOwner={checkOwner}
          onSent={onSent}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(writes()).toHaveLength(0);
      expect(screen.getByText(guest.email!)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Confirm send" }));
      expect((await screen.findByRole("status")).textContent).toContain(
        "accepted by the email service",
      );
      expect(onSent).toHaveBeenCalledWith(kind);
      expect(writes()).toHaveLength(1);
      expect(writes()[0]![0]).toBe(`/api/guests/${guest.id}/${endpoint}`);
      expect(writes()[0]![1]).toMatchObject({
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    },
  );
  it("hides send actions without email and reminder actions after a response", () => {
    const view = render(
      <GuestInvitationActions
        guest={{ ...guest, email: null }}
        checkOwner={checkOwner}
        onSent={onSent}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Send invitation email" }),
    ).toBeNull();
    expect(screen.getByText(/Add an email address/)).toBeTruthy();
    view.rerender(
      <GuestInvitationActions
        guest={{ ...guest, rsvpStatus: "ATTENDING", attendingCount: 2 }}
        checkOwner={checkOwner}
        onSent={onSent}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Send RSVP reminder" }),
    ).toBeNull();
  });
  it("retains confirmation after failed delivery and does not claim success", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { message: "Delivery failed." } },
        { status: 503 },
      ),
    );
    render(
      <GuestInvitationActions
        guest={guest}
        checkOwner={checkOwner}
        onSent={onSent}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Send RSVP reminder" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm send" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Delivery failed",
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(onSent).not.toHaveBeenCalled();
    expect(writes()).toHaveLength(1);
  });
});
