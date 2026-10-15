import mongoose from "mongoose";
import { createHmac } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET as list, POST as create } from "@/app/api/guests/route";
import {
  DELETE as remove,
  GET as get,
  PATCH as update,
} from "@/app/api/guests/[guestId]/route";
import { GET as summaryRoute } from "@/app/api/guests/rsvp-summary/route";
import { GET as dashboard } from "@/app/api/dashboard/route";
import { createSession } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db/mongoose";
import { GuestModel } from "@/server/models/guest";
import { SessionModel } from "@/server/models/session";
import { UserModel } from "@/server/models/user";
import { WeddingModel } from "@/server/models/wedding";
import { WeddingEventModel } from "@/server/models/wedding-event";
import { WeddingMembershipModel } from "@/server/models/wedding-membership";
import {
  createGuestSchema,
  guestListQuerySchema,
  updateGuestSchema,
} from "@/shared/guests/schemas";
import { GET as invitationLink } from "@/app/api/guests/[guestId]/invitation-link/route";
import { POST as sendInvitation } from "@/app/api/guests/[guestId]/send-invitation/route";
import { POST as sendReminder } from "@/app/api/guests/[guestId]/send-reminder/route";
import { GET as publicInvitation } from "@/app/api/public/invitations/[token]/route";
import { POST as rsvp } from "@/app/api/public/invitations/[token]/rsvp/route";
import { RateLimitCounterModel } from "@/server/models/rate-limit-counter";
import { sendEmailThroughResend } from "@/server/email/resend";
import { AppError } from "@/shared/errors";

vi.mock("@/server/email/resend", () => ({
  assertEmailDeliveryConfigured: vi.fn(),
  sendEmailThroughResend: vi.fn(),
}));

const cookie = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookie.token ? { value: cookie.token } : undefined),
    set: (_name: string, value: string) => {
      cookie.token = value;
    },
    delete: () => {
      cookie.token = null;
    },
  }),
}));
const origin = "http://localhost:3001";
const oid = () => new mongoose.Types.ObjectId();
const a = {
  wedding: oid(),
  admin: oid(),
  manager: oid(),
  event: oid(),
  guest: oid(),
};
const b = {
  wedding: oid(),
  admin: oid(),
  manager: oid(),
  event: oid(),
  guest: oid(),
};
let database: MongoMemoryServer | undefined;
const dbName = "guest_isolated_tests";
const models = [
  GuestModel,
  SessionModel,
  UserModel,
  WeddingModel,
  WeddingEventModel,
  WeddingMembershipModel,
  RateLimitCounterModel,
];
function request(path = "/api/guests", method = "GET", body?: unknown) {
  return new Request(origin + path, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const params = (guestId: mongoose.Types.ObjectId | string) => ({
  params: Promise.resolve({ guestId: String(guestId) }),
});

beforeAll(async () => {
  database = await MongoMemoryServer.create({
    binary: { version: "8.2.6" },
    instance: { dbName },
  });
  vi.stubEnv("MONGODB_URI", database.getUri());
  vi.stubEnv("MONGO_DB_NAME", dbName);
  vi.stubEnv("SESSION_SECRET", "disposable-guest-session-secret-only");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
  await connectToDatabase();
  await Promise.all(models.map((model) => model.init()));
}, 600_000);
beforeEach(async () => {
  expect(mongoose.connection.name).toBe(dbName);
  expect(mongoose.connection.port).toBe(database?.instanceInfo?.port);
  await Promise.all(models.map((model) => model.collection.deleteMany({})));
  cookie.token = null;
  vi.mocked(sendEmailThroughResend).mockReset().mockResolvedValue(undefined);
  for (const [label, fixture] of [
    ["A", a],
    ["B", b],
  ] as const) {
    await UserModel.create([
      {
        _id: fixture.admin,
        name: `${label} Admin`,
        email: `${label}-admin@example.test`,
        emailNormalized: `${label}-admin@example.test`,
        passwordHash: "test-only",
      },
      {
        _id: fixture.manager,
        name: `${label} Manager`,
        email: `${label}-manager@example.test`,
        emailNormalized: `${label}-manager@example.test`,
        passwordHash: "test-only",
      },
    ]);
    await WeddingModel.create({
      _id: fixture.wedding,
      brideName: `${label} Bride`,
      groomName: `${label} Groom`,
      weddingDate: "2027-02-14",
      location: { city: "Test city" },
      website: { slug: `${label}-guest-wedding` },
      gallery: { token: `${label}-test-gallery` },
      createdByUserId: fixture.admin,
    });
    await WeddingMembershipModel.create([
      { weddingId: fixture.wedding, userId: fixture.admin, role: "ADMIN" },
      { weddingId: fixture.wedding, userId: fixture.manager, role: "MANAGER" },
    ]);
    await WeddingEventModel.create({
      _id: fixture.event,
      weddingId: fixture.wedding,
      name: `${label} private ceremony`,
      startsAt: new Date("2027-02-14T12:00:00Z"),
    });
    await GuestModel.create({
      _id: fixture.guest,
      weddingId: fixture.wedding,
      name: `${label} private family`,
      email: `${label}-family@example.test`,
      emailNormalized: `${label.toLowerCase()}-family@example.test`,
      maxGuests: 4,
      invitedEventIds: [fixture.event],
      notes: `${label} private notes`,
    });
  }
});
afterAll(async () => {
  await mongoose.disconnect();
  await database?.stop();
  vi.unstubAllEnvs();
});

describe("guest schemas", () => {
  it("defaults optional contact and ceremony fields without inventing attendance", () => {
    expect(createGuestSchema.parse({ name: "  Rajesh & family  " })).toEqual({
      name: "Rajesh & family",
      maxGuests: 1,
      invitedEventIds: [],
    });
    expect(updateGuestSchema.safeParse({}).success).toBe(false);
  });
  it.each([
    { name: " " },
    { name: "Family", email: "not-email" },
    { name: "Family", maxGuests: 0 },
    { name: "Family", maxGuests: 2.5 },
    { name: "Family", maxGuests: 10001 },
    { name: "Family", phone: "<script>" },
    { name: "Family", notes: "n".repeat(2001) },
    { name: "Family", invitedEventIds: [String(a.event), String(a.event)] },
  ])("rejects invalid input %j", (body) => {
    expect(createGuestSchema.safeParse(body).success).toBe(false);
  });
  it("normalizes object ID case before duplicate validation", () => {
    expect(
      createGuestSchema.safeParse({
        name: "Family",
        invitedEventIds: [String(a.event), String(a.event).toUpperCase()],
      }).success,
    ).toBe(false);
  });
  it.each([
    { limit: "101" },
    { page: "0" },
    { rsvpStatus: "ACCEPTED" },
    { invitationSent: "yes" },
    { weddingId: String(b.wedding) },
  ])("rejects invalid queries %j", (query) => {
    expect(guestListQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("guest CRUD with real MongoDB, authentication and tenant isolation", () => {
  for (const [label, own, foreign] of [
    ["A", a, b],
    ["B", b, a],
  ] as const) {
    for (const role of ["admin", "manager"] as const) {
      it(`${label} ${role} can create, read, update and delete only their wedding's groups`, async () => {
        await createSession(String(own[role]));
        const listed = await list(request());
        expect(listed.headers.get("Cache-Control")).toBe("private, no-store");
        expect(await listed.json()).toMatchObject({
          data: [
            {
              id: String(own.guest),
              invitedEvents: [{ name: `${label} private ceremony` }],
            },
          ],
          pagination: { total: 1 },
        });
        expect((await get(request(), params(foreign.guest))).status).toBe(404);
        expect(
          (
            await update(
              request("/api/guests/x", "PATCH", { name: "Forged" }),
              params(foreign.guest),
            )
          ).status,
        ).toBe(404);
        expect(
          (
            await remove(
              request("/api/guests/x", "DELETE"),
              params(foreign.guest),
            )
          ).status,
        ).toBe(404);
        const created = await create(
          request("/api/guests", "POST", {
            name: "New group",
            invitedEventIds: [String(own.event)],
          }),
        );
        expect(created.status).toBe(201);
        const guest = (await created.json()).data;
        expect(guest).toMatchObject({
          maxGuests: 1,
          rsvpStatus: "PENDING",
          attendingCount: null,
          invitationSentAt: null,
        });
        const saved = await update(
          request("/api/guests/x", "PATCH", {
            name: "Updated group",
            maxGuests: 3,
          }),
          params(guest.id),
        );
        expect(saved.status).toBe(200);
        expect((await saved.json()).data.name).toBe("Updated group");
        expect(
          (await remove(request("/api/guests/x", "DELETE"), params(guest.id)))
            .status,
        ).toBe(200);
        expect((await get(request(), params(guest.id))).status).toBe(404);
        expect(await GuestModel.findById(foreign.guest).lean()).toMatchObject({
          name: `${label === "A" ? "B" : "A"} private family`,
        });
      });
      it(`${label} ${role} cannot associate foreign ceremonies or forge guest state`, async () => {
        await createSession(String(own[role]));
        expect(
          (
            await create(
              request("/api/guests", "POST", {
                name: "Foreign",
                invitedEventIds: [String(foreign.event)],
              }),
            )
          ).status,
        ).toBe(404);
        expect(
          (
            await update(
              request("/api/guests/x", "PATCH", {
                invitedEventIds: [String(foreign.event)],
              }),
              params(own.guest),
            )
          ).status,
        ).toBe(404);
        for (const field of [
          { weddingId: String(foreign.wedding) },
          { invitationToken: "forged" },
          { invitationSentAt: new Date().toISOString() },
          { rsvpStatus: "ATTENDING" },
          { attendingCount: 3 },
        ]) {
          expect(
            (
              await create(
                request("/api/guests", "POST", { name: "Forged", ...field }),
              )
            ).status,
          ).toBe(400);
          expect(
            (
              await update(
                request("/api/guests/x", "PATCH", field),
                params(own.guest),
              )
            ).status,
          ).toBe(400);
        }
      });
    }
  }

  it("never returns invitation secrets or normalized email in CRUD and keeps the secret stable", async () => {
    await createSession(String(a.admin));
    expect(
      (await GuestModel.findById(a.guest).lean())?.invitationToken,
    ).toBeUndefined();
    const secret = (await GuestModel.findById(a.guest)
      .select("+invitationToken")
      .lean())!.invitationToken;
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    for (const response of [
      await list(request()),
      await get(request(), params(a.guest)),
      await update(
        request("/api/guests/x", "PATCH", { notes: "Updated notes" }),
        params(a.guest),
      ),
      await create(request("/api/guests", "POST", { name: "Another group" })),
    ]) {
      const body = await response.text();
      expect(body).not.toContain(secret);
      expect(body).not.toContain("invitationToken");
      expect(body).not.toContain("emailNormalized");
      expect(body).not.toContain("weddingId");
    }
    expect(
      (await GuestModel.findById(a.guest).select("+invitationToken").lean())!
        .invitationToken,
    ).toBe(secret);
  });

  it("supports shared email, clearing fields, literal searches and pagination", async () => {
    await createSession(String(a.admin));
    for (const name of ["Z family", "[Family].*"])
      expect(
        (
          await create(
            request("/api/guests", "POST", {
              name,
              email: "shared@example.test",
            }),
          )
        ).status,
      ).toBe(201);
    const literal = await list(request("/api/guests?search=%5BFamily%5D.%2A"));
    expect(
      (await literal.json()).data.map((guest: { name: string }) => guest.name),
    ).toEqual(["[Family].*"]);
    const paginated = await list(request("/api/guests?page=2&limit=1"));
    expect(await paginated.json()).toMatchObject({
      data: [{ name: "Z family" }],
      pagination: { total: 3, totalPages: 3, page: 2 },
    });
    const cleared = await update(
      request("/api/guests/x", "PATCH", {
        email: "",
        phone: "",
        notes: "",
        invitedEventIds: [],
      }),
      params(a.guest),
    );
    expect((await cleared.json()).data).toMatchObject({
      email: null,
      phone: null,
      notes: null,
      invitedEventIds: [],
    });
  });

  it("retains archived and unavailable associations but rejects new archived references", async () => {
    await createSession(String(a.admin));
    await WeddingEventModel.updateOne(
      { _id: a.event },
      { $set: { archivedAt: new Date() } },
    );
    expect(
      (
        await update(
          request("/api/guests/x", "PATCH", {
            invitedEventIds: [String(a.event)],
          }),
          params(a.guest),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await create(
          request("/api/guests", "POST", {
            name: "New family",
            invitedEventIds: [String(a.event)],
          }),
        )
      ).status,
    ).toBe(404);
    await WeddingEventModel.deleteOne({ _id: a.event });
    expect(
      (
        await update(
          request("/api/guests/x", "PATCH", {
            invitedEventIds: [String(a.event)],
          }),
          params(a.guest),
        )
      ).status,
    ).toBe(200);
    expect(
      (await (await get(request(), params(a.guest))).json()).data
        .invitedEvents[0],
    ).toMatchObject({ name: "Unavailable event", unavailable: true });
  });

  it("guards existing confirmed attendance and preserves RSVP and delivery state", async () => {
    await createSession(String(a.admin));
    await GuestModel.updateOne(
      { _id: a.guest },
      {
        $set: {
          rsvpStatus: "ATTENDING",
          attendingCount: 3,
          invitationSentAt: new Date(),
        },
      },
    );
    expect(
      (
        await update(
          request("/api/guests/x", "PATCH", { maxGuests: 2 }),
          params(a.guest),
        )
      ).status,
    ).toBe(400);
    const saved = await update(
      request("/api/guests/x", "PATCH", {
        maxGuests: 3,
        name: "Same response",
      }),
      params(a.guest),
    );
    expect((await saved.json()).data).toMatchObject({
      maxGuests: 3,
      rsvpStatus: "ATTENDING",
      attendingCount: 3,
      invitationSentAt: expect.any(String),
    });
  });

  it("returns 409 when the stored version changes between read and update", async () => {
    await createSession(String(a.admin));
    const original = GuestModel.findOne.bind(GuestModel);
    vi.spyOn(GuestModel, "findOne").mockImplementationOnce((...args) => {
      const query = original(...args);
      const execute = query.exec.bind(query);
      vi.spyOn(query, "exec").mockImplementationOnce(async () => {
        const read = await execute();
        await GuestModel.updateOne(
          { _id: a.guest },
          {
            $set: { rsvpStatus: "ATTENDING", attendingCount: 4 },
            $inc: { __v: 1 },
          },
        );
        return read;
      });
      return query;
    });
    const response = await update(
      request("/api/guests/x", "PATCH", { maxGuests: 3 }),
      params(a.guest),
    );
    expect(response.status).toBe(409);
    expect(await GuestModel.findById(a.guest).lean()).toMatchObject({
      maxGuests: 4,
      attendingCount: 4,
    });
  });

  it("filters combine within the tenant and summaries distinguish groups, capacity and attendees", async () => {
    await createSession(String(a.manager));
    await GuestModel.updateOne(
      { _id: a.guest },
      {
        $set: {
          rsvpStatus: "ATTENDING",
          attendingCount: 3,
          invitationSentAt: new Date(),
        },
      },
    );
    expect(
      (await (await list(request(`/api/guests?eventId=${b.event}`))).json())
        .data,
    ).toEqual([]);
    expect(
      (
        await (
          await list(
            request(
              `/api/guests?eventId=${a.event}&rsvpStatus=ATTENDING&invitationSent=true&search=private`,
            ),
          )
        ).json()
      ).data,
    ).toHaveLength(1);
    expect(
      (await (await list(request("/api/guests?invitationSent=false"))).json())
        .data,
    ).toEqual([]);
    expect((await summaryRoute()).status).toBe(200);
    expect((await (await summaryRoute()).json()).data).toEqual({
      totalGuests: 1,
      totalGuestCapacity: 4,
      pendingInvitations: 0,
      attendingInvitations: 1,
      notAttendingInvitations: 0,
      totalPeopleAttending: 3,
    });
    expect((await (await dashboard()).json()).data.summary).toMatchObject({
      guests: 1,
      guestCapacity: 4,
      peopleAttending: 3,
    });
  });

  it("rejects invalid JSON, large bodies, duplicate and forged query parameters", async () => {
    await createSession(String(a.admin));
    for (const method of ["POST", "PATCH"]) {
      const invalid = new Request(origin + "/api/guests", {
        method,
        headers: { Origin: origin },
        body: "{",
      });
      expect(
        (method === "POST"
          ? await create(invalid)
          : await update(invalid, params(a.guest))
        ).status,
      ).toBe(400);
    }
    expect(
      (await create(request("/api/guests", "POST", { name: "n".repeat(9000) })))
        .status,
    ).toBe(413);
    for (const query of [
      "page=1&page=2",
      `weddingId=${b.wedding}`,
      "eventId=bad",
    ])
      expect((await list(request("/api/guests?" + query))).status).toBe(400);
  });
  it("rejects cross-origin writes", async () => {
    await createSession(String(a.admin));
    expect(
      (
        await create(
          new Request(origin + "/api/guests", {
            method: "POST",
            headers: { Origin: "https://attacker.test" },
            body: JSON.stringify({ name: "Forged" }),
          }),
        )
      ).status,
    ).toBe(403);
    expect(await GuestModel.countDocuments({})).toBe(2);
  });
  it("requires authentication for every guest operation and summary", async () => {
    const responses = await Promise.all([
      list(request()),
      create(request("/api/guests", "POST", { name: "Unauthorized" })),
      get(request(), params(a.guest)),
      update(
        request("/api/guests/x", "PATCH", { name: "Unauthorized" }),
        params(a.guest),
      ),
      remove(request("/api/guests/x", "DELETE"), params(a.guest)),
      summaryRoute(),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401, 401, 401, 401,
    ]);
  });
  it("returns generic 404 for foreign, missing and malformed IDs, and sanitizes server errors", async () => {
    await createSession(String(a.admin));
    const bodies = await Promise.all(
      [b.guest, oid(), "bad"].map(async (id) =>
        (await get(request(), params(id))).json(),
      ),
    );
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
    vi.spyOn(GuestModel, "find").mockImplementationOnce(() => {
      throw new Error("Sensitive database details");
    });
    const response = await list(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("Sensitive");
  });
  it("enforces database RSVP integrity and a unique stable token index", async () => {
    const invalid = new GuestModel({
      weddingId: a.wedding,
      name: "Invalid RSVP",
      maxGuests: 2,
      rsvpStatus: "ATTENDING",
      attendingCount: 3,
    });
    await expect(invalid.validate()).rejects.toThrow("Attendance must match");
    const token = (await GuestModel.findById(a.guest)
      .select("+invitationToken")
      .lean())!.invitationToken;
    await expect(
      GuestModel.create({
        weddingId: a.wedding,
        name: "Duplicate token",
        invitationToken: token,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});

const tokenFor = async (guestId = a.guest) =>
  (await GuestModel.findById(guestId).select("+invitationToken").lean())!
    .invitationToken;
const tokenParams = (token: string) => ({ params: Promise.resolve({ token }) });
const reply = (body: unknown) =>
  request("/api/public/invitations/test/rsvp", "POST", body);

describe("stable links, private public invitations, RSVP and immediate email", () => {
  for (const [label, own, foreign] of [
    ["A", a, b],
    ["B", b, a],
  ] as const) {
    for (const role of ["admin", "manager"] as const) {
      it(`${label} ${role} retrieves only their wedding's stable invitation link`, async () => {
        await createSession(String(own[role]));
        const first = await invitationLink(request(), params(own.guest));
        expect(first.status).toBe(200);
        const body = await first.json();
        expect(body.data.url).toBe(
          `${origin}/invite/${await tokenFor(own.guest)}`,
        );
        expect(
          await (await invitationLink(request(), params(own.guest))).json(),
        ).toEqual(body);
        expect(
          (await invitationLink(request(), params(foreign.guest))).status,
        ).toBe(404);
        expect(await GuestModel.findById(own.guest).lean()).toMatchObject({
          invitationSentAt: null,
        });
      });
      it(`${label} ${role} sends only their own guest emails`, async () => {
        await createSession(String(own[role]));
        expect(
          (
            await sendInvitation(
              request("/api/guests/x/send-invitation", "POST"),
              params(foreign.guest),
            )
          ).status,
        ).toBe(404);
        expect(sendEmailThroughResend).not.toHaveBeenCalled();
        const sent = await sendInvitation(
          request("/api/guests/x/send-invitation", "POST"),
          params(own.guest),
        );
        expect(sent.status).toBe(200);
        const email = vi.mocked(sendEmailThroughResend).mock.calls[0]![0];
        expect(email.to).toBe(`${label}-family@example.test`);
        expect(email.text).toContain(
          `${origin}/invite/${await tokenFor(own.guest)}`,
        );
        expect(email.html).not.toContain(`${label} private notes`);
        expect(email.idempotencyKey).toMatch(/^guest-[a-f0-9]{64}$/);
        const saved = await GuestModel.findById(own.guest).lean();
        expect(saved?.invitationSentAt).toBeInstanceOf(Date);
        expect(saved?.rsvpStatus).toBe("PENDING");
        expect(
          (await GuestModel.findById(foreign.guest).lean())?.invitationSentAt,
        ).toBeNull();
      });
    }
  }

  it("exposes only explicitly permitted public fields and active invited own-wedding events", async () => {
    const archived = await WeddingEventModel.create({
      weddingId: a.wedding,
      name: "Archived ceremony",
      startsAt: new Date(),
      archivedAt: new Date(),
    });
    await WeddingEventModel.create({
      weddingId: a.wedding,
      name: "Uninvited ceremony",
      startsAt: new Date(),
    });
    // Even a corrupted stored foreign event ID must not escape the public boundary.
    await GuestModel.updateOne(
      { _id: a.guest },
      { $push: { invitedEventIds: { $each: [b.event, archived._id] } } },
    );
    const token = await tokenFor();
    const response = await publicInvitation(request(), tokenParams(token));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(
      body.data.events.map((event: { name: string }) => event.name),
    ).toEqual(["A private ceremony"]);
    expect(Object.keys(body.data.guest).sort()).toEqual([
      "attendingCount",
      "maxGuests",
      "name",
      "rsvpStatus",
    ]);
    for (const forbidden of [
      token,
      String(a.wedding),
      String(a.guest),
      String(a.event),
      "A private notes",
      "A-family@example.test",
      "B private",
      "Archived ceremony",
      "Uninvited ceremony",
      "gallery",
      "members",
    ])
      expect(JSON.stringify(body)).not.toContain(forbidden);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
  });
  it("saves a response without login, permits changes, and makes repeated responses idempotent", async () => {
    const token = await tokenFor();
    const yes = await rsvp(
      reply({ status: "ATTENDING", attendingCount: 3 }),
      tokenParams(token),
    );
    expect(yes.status).toBe(200);
    expect((await yes.json()).data).toMatchObject({
      status: "ATTENDING",
      attendingCount: 3,
    });
    const first = await GuestModel.findById(a.guest).lean();
    expect(
      (
        await rsvp(
          reply({ status: "ATTENDING", attendingCount: 3 }),
          tokenParams(token),
        )
      ).status,
    ).toBe(200);
    const same = await GuestModel.findById(a.guest).lean();
    expect(same?.__v).toBe(first?.__v);
    expect(same?.rsvpUpdatedAt).toEqual(first?.rsvpUpdatedAt);
    const no = await rsvp(
      reply({ status: "NOT_ATTENDING", attendingCount: 0 }),
      tokenParams(token),
    );
    expect((await no.json()).data).toMatchObject({
      status: "NOT_ATTENDING",
      attendingCount: 0,
    });
    expect((await GuestModel.findById(b.guest).lean())?.rsvpStatus).toBe(
      "PENDING",
    );
    await createSession(String(a.admin));
    expect((await (await summaryRoute()).json()).data).toMatchObject({
      notAttendingInvitations: 1,
      totalPeopleAttending: 0,
    });
  });
  it.each([
    { status: "ATTENDING", attendingCount: 0 },
    { status: "ATTENDING", attendingCount: 1.5 },
    { status: "NOT_ATTENDING", attendingCount: 1 },
    { status: "PENDING", attendingCount: 1 },
    { status: "ATTENDING", attendingCount: 2, weddingId: String(b.wedding) },
  ])("rejects invalid RSVP %j without consuming quota", async (body) => {
    expect(
      (await rsvp(reply(body), tokenParams(await tokenFor()))).status,
    ).toBe(400);
    expect(await RateLimitCounterModel.countDocuments({})).toBe(0);
  });
  it("rejects a count above current capacity before consuming quota", async () => {
    const response = await rsvp(
      reply({ status: "ATTENDING", attendingCount: 5 }),
      tokenParams(await tokenFor()),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("PARTY_SIZE_CHANGED");
    expect(await RateLimitCounterModel.countDocuments({})).toBe(0);
  });
  it("invalid, missing and deleted links have the same generic unavailable response", async () => {
    const token = await tokenFor();
    const invalid = await publicInvitation(request(), tokenParams("bad"));
    const missing = await publicInvitation(
      request(),
      tokenParams("z".repeat(43)),
    );
    await GuestModel.deleteOne({ _id: a.guest });
    const deleted = await publicInvitation(request(), tokenParams(token));
    expect(invalid.status).toBe(404);
    expect(await missing.json()).toEqual(await invalid.json());
    expect((await deleted.json()).error.code).toBe("NOT_FOUND");
    expect(
      (
        await rsvp(
          reply({ status: "ATTENDING", attendingCount: 1 }),
          tokenParams(token),
        )
      ).status,
    ).toBe(404);
    expect(await RateLimitCounterModel.countDocuments({})).toBe(0);
  });
  it("a deleted wedding makes both public reads and replies unavailable", async () => {
    await WeddingModel.updateOne(
      { _id: a.wedding },
      { $set: { deletedAt: new Date() } },
    );
    const token = await tokenFor();
    expect((await publicInvitation(request(), tokenParams(token))).status).toBe(
      404,
    );
    expect(
      (
        await rsvp(
          reply({ status: "ATTENDING", attendingCount: 1 }),
          tokenParams(token),
        )
      ).status,
    ).toBe(404);
  });
  it("limits repeated responses per invitation without storing raw tokens or spending rejected shared quota", async () => {
    const token = await tokenFor();
    for (let index = 0; index < 20; index++)
      expect(
        (
          await rsvp(
            reply({ status: "NOT_ATTENDING", attendingCount: 0 }),
            tokenParams(token),
          )
        ).status,
      ).toBe(200);
    const limited = await rsvp(
      reply({ status: "NOT_ATTENDING", attendingCount: 0 }),
      tokenParams(token),
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    const counters = await RateLimitCounterModel.find().lean();
    expect(
      counters.map((counter) => counter.count).sort((a, b) => a - b),
    ).toEqual([20, 21]);
    expect(JSON.stringify(counters)).not.toContain(token);
  });
  it("blocks foreign-origin, malformed JSON and unknown public query parameters before quota", async () => {
    const route = tokenParams(await tokenFor());
    expect(
      (
        await rsvp(
          new Request(origin + "/api/public/invitations/test/rsvp", {
            method: "POST",
            headers: { Origin: "https://attacker.test" },
            body: JSON.stringify({ status: "ATTENDING", attendingCount: 1 }),
          }),
          route,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await rsvp(
          new Request(origin + "/api/public/invitations/test/rsvp", {
            method: "POST",
            body: "{",
          }),
          route,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await rsvp(
          request("/api/public/invitations/test/rsvp?extra=true", "POST", {
            status: "ATTENDING",
            attendingCount: 1,
          }),
          route,
        )
      ).status,
    ).toBe(400);
    expect(await RateLimitCounterModel.countDocuments({})).toBe(0);
  });
  it("enforces the shared RSVP quota and does not alter a response when it is exhausted", async () => {
    const now = Date.now();
    const windowStartedAt = new Date(Math.floor(now / 60_000) * 60_000);
    const keyHash = createHmac("sha256", "disposable-guest-session-secret-only")
      .update("guest-rsvp-global:all")
      .digest("hex");
    await RateLimitCounterModel.create({
      keyHash,
      windowStartedAt,
      count: 300,
      expiresAt: new Date(now + 120_000),
    });
    const response = await rsvp(
      reply({ status: "ATTENDING", attendingCount: 1 }),
      tokenParams(await tokenFor()),
    );
    expect(response.status).toBe(429);
    expect((await GuestModel.findById(a.guest).lean())?.rsvpStatus).toBe(
      "PENDING",
    );
  });
  it("never builds a sharing URL from an incoming Host header", async () => {
    await createSession(String(a.admin));
    const response = await invitationLink(
      new Request("https://attacker.test/api/guests/x/invitation-link", {
        headers: { Host: "attacker.test" },
      }),
      params(a.guest),
    );
    expect((await response.json()).data.url).toBe(
      `${origin}/invite/${await tokenFor()}`,
    );
  });
  it("clears delivery state when the invitation recipient changes while keeping the stable link", async () => {
    await createSession(String(a.admin));
    const token = await tokenFor();
    expect(
      (
        await sendInvitation(
          request("/api/guests/x/send-invitation", "POST"),
          params(a.guest),
        )
      ).status,
    ).toBe(200);
    const response = await update(
      request("/api/guests/x", "PATCH", {
        email: "new-recipient@example.test",
      }),
      params(a.guest),
    );
    expect((await response.json()).data).toMatchObject({
      invitationSentAt: null,
      lastReminderSentAt: null,
      reminderCount: 0,
    });
    expect(await tokenFor()).toBe(token);
  });
  it("rejects a concurrent RSVP when an organiser changes capacity between read and update", async () => {
    const token = await tokenFor();
    const original = GuestModel.findOne.bind(GuestModel);
    vi.spyOn(GuestModel, "findOne").mockImplementationOnce((...args) => {
      const query = original(...args);
      const execute = query.exec.bind(query);
      vi.spyOn(query, "exec").mockImplementationOnce(async () => {
        const read = await execute();
        await GuestModel.updateOne(
          { _id: a.guest },
          { $set: { maxGuests: 1 }, $inc: { __v: 1 } },
        );
        return read;
      });
      return query;
    });
    expect(
      (
        await rsvp(
          reply({ status: "ATTENDING", attendingCount: 3 }),
          tokenParams(token),
        )
      ).status,
    ).toBe(409);
    expect(await GuestModel.findById(a.guest).lean()).toMatchObject({
      maxGuests: 1,
      rsvpStatus: "PENDING",
      attendingCount: null,
    });
  });
  it("does not mark a failed email as sent and never sends reminders to responded or email-less groups", async () => {
    await createSession(String(a.admin));
    vi.mocked(sendEmailThroughResend).mockRejectedValueOnce(
      new AppError(
        "EMAIL_DELIVERY_FAILED",
        "Provider rejected the message.",
        503,
      ),
    );
    expect(
      (
        await sendInvitation(
          request("/api/guests/x/send-invitation", "POST"),
          params(a.guest),
        )
      ).status,
    ).toBe(503);
    expect(
      (await GuestModel.findById(a.guest).lean())?.invitationSentAt,
    ).toBeNull();
    await GuestModel.updateOne(
      { _id: a.guest },
      { $set: { rsvpStatus: "ATTENDING", attendingCount: 2 } },
    );
    expect(
      (
        await sendReminder(
          request("/api/guests/x/send-reminder", "POST"),
          params(a.guest),
        )
      ).status,
    ).toBe(409);
    await GuestModel.updateOne(
      { _id: a.guest },
      { $set: { email: "", rsvpStatus: "PENDING", attendingCount: null } },
    );
    expect(
      (
        await sendInvitation(
          request("/api/guests/x/send-invitation", "POST"),
          params(a.guest),
        )
      ).status,
    ).toBe(400);
    expect(sendEmailThroughResend).toHaveBeenCalledTimes(1);
  });
  it("deduplicates reminder metadata for the same provider idempotency key", async () => {
    await createSession(String(a.manager));
    vi.spyOn(Date, "now").mockReturnValue(Date.now());
    for (let index = 0; index < 2; index++)
      expect(
        (
          await sendReminder(
            request("/api/guests/x/send-reminder", "POST"),
            params(a.guest),
          )
        ).status,
      ).toBe(200);
    const calls = vi.mocked(sendEmailThroughResend).mock.calls;
    expect(calls[0]![0].idempotencyKey).toBe(calls[1]![0].idempotencyKey);
    expect(await GuestModel.findById(a.guest).lean()).toMatchObject({
      reminderCount: 1,
      invitationSentAt: null,
      lastReminderSentAt: expect.any(Date),
    });
  });
  it("escapes email content and detects an address change during provider delivery", async () => {
    await createSession(String(a.admin));
    await GuestModel.updateOne(
      { _id: a.guest },
      { $set: { name: "<script>Family & friends</script>" } },
    );
    vi.mocked(sendEmailThroughResend).mockImplementationOnce(async () => {
      await GuestModel.updateOne(
        { _id: a.guest },
        { $set: { email: "changed@example.test" }, $inc: { __v: 1 } },
      );
    });
    const response = await sendInvitation(
      request("/api/guests/x/send-invitation", "POST"),
      params(a.guest),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("EMAIL_SENT_STATE_CHANGED");
    const email = vi.mocked(sendEmailThroughResend).mock.calls[0]![0];
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(
      (await GuestModel.findById(a.guest).lean())?.invitationSentAt,
    ).toBeNull();
  });
  it("requires a session for all private invitation operations", async () => {
    expect((await invitationLink(request(), params(a.guest))).status).toBe(401);
    expect(
      (
        await sendInvitation(
          request("/api/guests/x/send-invitation", "POST"),
          params(a.guest),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await sendReminder(
          request("/api/guests/x/send-reminder", "POST"),
          params(a.guest),
        )
      ).status,
    ).toBe(401);
    expect(sendEmailThroughResend).not.toHaveBeenCalled();
  });
});
