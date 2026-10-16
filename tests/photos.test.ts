import mongoose from "mongoose";
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
import { GET, POST } from "@/app/api/photos/route";
import { POST as upload } from "@/app/api/photos/upload-url/route";
import { DELETE } from "@/app/api/photos/[photoId]/route";
import { GET as download } from "@/app/api/photos/[photoId]/download/route";
import { PhotoModel } from "@/modules/photos/model";
import { createSession } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db/mongoose";
import { UserModel } from "@/server/models/user";
import { WeddingModel } from "@/server/models/wedding";
import { WeddingMembershipModel } from "@/server/models/wedding-membership";
import { WeddingEventModel } from "@/server/models/wedding-event";
import { SessionModel } from "@/server/models/session";
import { RateLimitCounterModel } from "@/server/models/rate-limit-counter";
import {
  deletePhotoObject,
  publishPhotoObject,
  signPhotoRead,
  signPhotoUpload,
} from "@/server/storage/r2";
import { AppError, RateLimitError } from "@/shared/errors";
import {
  photoUploadSchema,
  photoConfirmationSchema,
  photoListSchema,
} from "@/shared/photos/schemas";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { photoFixtures } from "./fixtures/photos";

const cookie = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookie.token ? { value: cookie.token } : undefined),
    set: (_name: string, token: string) => {
      cookie.token = token;
    },
  }),
}));
vi.mock("@/server/storage/r2", () => ({
  signPhotoUpload: vi.fn(),
  signPhotoRead: vi.fn(),
  publishPhotoObject: vi.fn(),
  deletePhotoObject: vi.fn(),
}));
vi.mock("@/server/security/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
const id = () => new mongoose.Types.ObjectId();
const a = {
  wedding: id(),
  admin: id(),
  manager: id(),
  adminMember: id(),
  managerMember: id(),
  event: id(),
};
const b = {
  wedding: id(),
  admin: id(),
  manager: id(),
  adminMember: id(),
  managerMember: id(),
  event: id(),
};
const models = [
  PhotoModel,
  UserModel,
  WeddingModel,
  WeddingMembershipModel,
  WeddingEventModel,
  SessionModel,
  RateLimitCounterModel,
];
const metadata = {
  filename: "ceremony.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 120,
  eventId: a.event.toString(),
};
const origin = "http://localhost:3001";
let db: MongoMemoryServer;
function request(
  method = "GET",
  body?: unknown,
  query = "",
  requestOrigin = origin,
) {
  return new Request(`${origin}/api/photos${query}`, {
    method,
    headers: { Origin: requestOrigin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const params = (photoId: string) => ({ params: Promise.resolve({ photoId }) });
async function reserve() {
  const response = await upload(request("POST", metadata));
  expect(response.status).toBe(201);
  return (await response.json()).data as { objectKey: string };
}
async function publish() {
  const grant = await reserve();
  const response = await POST(
    request("POST", { ...metadata, objectKey: grant.objectKey }),
  );
  expect(response.status).toBe(201);
  return { grant, photo: (await response.json()).data };
}

beforeAll(async () => {
  db = await MongoMemoryServer.create({
    binary: { version: "8.2.6" },
    instance: { dbName: "gallery_disposable_test" },
  });
  vi.stubEnv("MONGODB_URI", db.getUri());
  vi.stubEnv("MONGO_DB_NAME", "gallery_disposable_test");
  vi.stubEnv("SESSION_SECRET", "gallery-test-only-session-secret");
  await connectToDatabase();
  await Promise.all(models.map((model) => model.init()));
}, 600_000);
beforeEach(async () => {
  expect(mongoose.connection.port).toBe(db.instanceInfo?.port);
  expect(mongoose.connection.name).toBe("gallery_disposable_test");
  await Promise.all(models.map((model) => model.collection.deleteMany({})));
  vi.mocked(enforceRateLimit).mockReset().mockResolvedValue(undefined);
  vi.mocked(signPhotoUpload)
    .mockReset()
    .mockResolvedValue("https://storage.example.test/upload");
  vi.mocked(signPhotoRead)
    .mockReset()
    .mockResolvedValue("https://storage.example.test/read");
  vi.mocked(publishPhotoObject).mockReset().mockResolvedValue(undefined);
  vi.mocked(deletePhotoObject).mockReset().mockResolvedValue(undefined);
  cookie.token = null;
  for (const [label, fixture] of [
    ["a", a],
    ["b", b],
  ] as const) {
    await UserModel.create([
      {
        _id: fixture.admin,
        name: "Admin",
        email: `${label}-admin@example.test`,
        emailNormalized: `${label}-admin@example.test`,
        passwordHash: "test",
      },
      {
        _id: fixture.manager,
        name: "Manager",
        email: `${label}-manager@example.test`,
        emailNormalized: `${label}-manager@example.test`,
        passwordHash: "test",
      },
    ]);
    await WeddingModel.create({
      _id: fixture.wedding,
      brideName: "Bride",
      groomName: "Groom",
      weddingDate: "2027-02-14",
      location: { city: "Test" },
      website: { slug: `test-${label}` },
      gallery: { token: `gallery-${label}` },
      createdByUserId: fixture.admin,
    });
    await WeddingMembershipModel.create([
      {
        _id: fixture.adminMember,
        weddingId: fixture.wedding,
        userId: fixture.admin,
        role: "ADMIN",
      },
      {
        _id: fixture.managerMember,
        weddingId: fixture.wedding,
        userId: fixture.manager,
        role: "MANAGER",
      },
    ]);
    await WeddingEventModel.create({
      _id: fixture.event,
      weddingId: fixture.wedding,
      name: "Ceremony",
      startsAt: new Date(),
    });
  }
  await createSession(a.admin.toString());
});
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
  vi.unstubAllEnvs();
});

describe("photo validation", () => {
  it("rejects unsupported types, mismatched extensions, oversized and empty photos, injected tenant fields", () => {
    for (const input of [
      { ...metadata, mimeType: "image/svg+xml" },
      { ...metadata, filename: "photo.png" },
      { ...metadata, sizeBytes: 0 },
      { ...metadata, sizeBytes: 10 * 1024 * 1024 + 1 },
      { ...metadata, weddingId: b.wedding.toString() },
      { ...metadata, filename: "../photo.jpg" },
    ])
      expect(photoUploadSchema.safeParse(input).success).toBe(false);
    expect(
      photoUploadSchema.parse({ ...metadata, sizeBytes: 10 * 1024 * 1024 })
        .sizeBytes,
    ).toBe(10 * 1024 * 1024);
    expect(
      photoConfirmationSchema.safeParse({
        ...metadata,
        objectKey: "weddings/../photo.jpg",
      }).success,
    ).toBe(false);
    expect(photoListSchema.safeParse({ limit: "49" }).success).toBe(false);
  });
});
describe("photo API with real sessions, memberships and persistence", () => {
  it.each(["admin", "manager"] as const)(
    "%s can reserve, confirm, list, download and delete with real membership checks",
    async (role) => {
      await createSession(a[role].toString());
      const { photo } = await publish();
      expect(
        (
          await PhotoModel.findById(photo.id).lean()
        )?.uploadedByMembershipId?.toString(),
      ).toBe(a[`${role}Member`].toString());
      const list = await (await GET(request())).json();
      expect(list.data.map((item: { id: string }) => item.id)).toEqual([
        photo.id,
      ]);
      expect((await download(request(), params(photo.id))).status).toBe(200);
      expect((await DELETE(request("DELETE"), params(photo.id))).status).toBe(
        200,
      );
      expect((await PhotoModel.findById(photo.id).lean())?.status).toBe(
        "DELETED",
      );
      expect((await (await GET(request())).json()).data).toEqual([]);
    },
  );
  it("rejects reusable invalid metadata fixtures before signing or reserving", async () => {
    const fixtures = photoFixtures();
    for (const file of [
      fixtures.oversized,
      fixtures.empty,
      fixtures.mismatch,
      fixtures.unsupported,
    ]) {
      expect(
        (
          await upload(
            request("POST", {
              filename: file.name,
              mimeType: file.mimeType,
              sizeBytes: file.buffer.length,
            }),
          )
        ).status,
      ).toBe(400);
    }
    expect(signPhotoUpload).not.toHaveBeenCalled();
    expect(enforceRateLimit).not.toHaveBeenCalled();
    expect(await PhotoModel.countDocuments()).toBe(0);
  });
  it("keeps invalid image confirmations out of the gallery", async () => {
    const grant = await reserve();
    vi.mocked(publishPhotoObject).mockRejectedValueOnce(
      new AppError("INVALID_PHOTO", "This file is not a supported photo.", 400),
    );
    expect(
      (await POST(request("POST", { ...metadata, objectKey: grant.objectKey })))
        .status,
    ).toBe(400);
    expect(
      (await PhotoModel.findOne({ uploadKey: grant.objectKey }).lean())?.status,
    ).toBe("PENDING");
    expect((await (await GET(request())).json()).data).toEqual([]);
  });
  it("allows repeated content in separate reservations but not duplicate confirmation rows", async () => {
    const first = await publish();
    const second = await publish();
    expect(first.photo.id).not.toBe(second.photo.id);
    await POST(
      request("POST", { ...metadata, objectKey: first.grant.objectKey }),
    );
    expect(await PhotoModel.countDocuments({ status: "READY" })).toBe(2);
  });
  it("requires authentication for every route and origin checks on every mutation", async () => {
    cookie.token = null;
    for (const response of [
      await GET(request()),
      await upload(request("POST", metadata)),
      await POST(request("POST", metadata)),
      await DELETE(request("DELETE"), params(id().toString())),
      await download(request(), params(id().toString())),
    ]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
    await createSession(a.admin.toString());
    expect(
      (await upload(request("POST", metadata, "", "https://unrelated.example")))
        .status,
    ).toBe(403);
    expect(
      (await POST(request("POST", metadata, "", "https://unrelated.example")))
        .status,
    ).toBe(403);
    expect(
      (
        await DELETE(
          request("DELETE", undefined, "", "https://unrelated.example"),
          params(id().toString()),
        )
      ).status,
    ).toBe(403);
    expect(signPhotoUpload).not.toHaveBeenCalled();
  });
  it("reserves a member-bound staging key, hides pending rows, then publishes idempotently", async () => {
    const grant = await reserve();
    expect(grant.objectKey).toMatch(
      new RegExp(`^weddings/${a.wedding}/uploads/`),
    );
    expect((await (await GET(request())).json()).data).toEqual([]);
    const confirm = { ...metadata, objectKey: grant.objectKey };
    const first = await POST(request("POST", confirm));
    expect(first.status).toBe(201);
    const second = await POST(request("POST", confirm));
    expect(second.status).toBe(201);
    expect((await first.json()).data.id).toBe((await second.json()).data.id);
    expect(publishPhotoObject).toHaveBeenCalledTimes(1);
    const row = await PhotoModel.findOne({ weddingId: a.wedding }).lean();
    expect(row?.status).toBe("READY");
    expect(row?.objectKey).not.toBe(grant.objectKey);
    expect(row?.objectKey).toContain("/photos/");
    const list = await (await GET(request())).json();
    expect(list.data).toHaveLength(1);
    expect(list.total).toBe(1);
    expect(JSON.stringify(list)).not.toContain("uploadKey");
    expect(JSON.stringify(list)).not.toContain("uploadedByMembershipId");
  });
  it("prevents both other weddings and another member from confirming a reservation", async () => {
    const grant = await reserve();
    for (const user of [a.manager, b.admin, b.manager]) {
      await createSession(user.toString());
      expect(
        (
          await POST(
            request("POST", { ...metadata, objectKey: grant.objectKey }),
          )
        ).status,
      ).toBe(404);
    }
    expect(publishPhotoObject).not.toHaveBeenCalled();
  });
  it.each(["admin", "manager"] as const)(
    "%s can view/delete own wedding photos but cannot access a foreign wedding",
    async (role) => {
      const { photo } = await publish();
      await createSession(b[role].toString());
      expect((await (await GET(request())).json()).data).toEqual([]);
      const missing = await download(request(), params(id().toString()));
      const foreign = await download(request(), params(photo.id));
      expect(foreign.status).toBe(404);
      expect(await foreign.json()).toEqual(await missing.json());
      expect((await DELETE(request("DELETE"), params(photo.id))).status).toBe(
        404,
      );
      expect(deletePhotoObject).toHaveBeenCalledTimes(1); // staging cleanup only
      await createSession(a[role].toString());
      expect((await download(request(), params(photo.id))).status).toBe(200);
      expect((await DELETE(request("DELETE"), params(photo.id))).status).toBe(
        200,
      );
      expect((await PhotoModel.findById(photo.id).lean())?.status).toBe(
        "DELETED",
      );
    },
  );
  it("rejects foreign/archived event assignments before quota, and bad metadata before signing", async () => {
    for (const eventId of [b.event.toString(), id().toString()])
      expect(
        (await upload(request("POST", { ...metadata, eventId }))).status,
      ).toBe(400);
    await WeddingEventModel.updateOne(
      { _id: a.event },
      { $set: { archivedAt: new Date() } },
    );
    expect((await upload(request("POST", metadata))).status).toBe(400);
    expect(enforceRateLimit).not.toHaveBeenCalled();
    expect(signPhotoUpload).not.toHaveBeenCalled();
    expect(
      (
        await upload(
          request("POST", { ...metadata, weddingId: b.wedding.toString() }),
        )
      ).status,
    ).toBe(400);
  });
  it("preserves pending metadata on storage failure and rejects altered confirmation metadata", async () => {
    const grant = await reserve();
    expect(
      (
        await POST(
          request("POST", {
            ...metadata,
            sizeBytes: 121,
            objectKey: grant.objectKey,
          }),
        )
      ).status,
    ).toBe(400);
    vi.mocked(publishPhotoObject).mockRejectedValueOnce(
      new AppError("STORAGE_UNAVAILABLE", "Please retry.", 503),
    );
    expect(
      (await POST(request("POST", { ...metadata, objectKey: grant.objectKey })))
        .status,
    ).toBe(503);
    expect(
      (await PhotoModel.findOne({ uploadKey: grant.objectKey }).lean())?.status,
    ).toBe("PENDING");
  });
  it("never resurrects a deleted upload and retains ready metadata when deletion fails", async () => {
    const { photo, grant } = await publish();
    vi.mocked(deletePhotoObject).mockRejectedValueOnce(
      new AppError("STORAGE_UNAVAILABLE", "Please retry.", 503),
    );
    expect((await DELETE(request("DELETE"), params(photo.id))).status).toBe(
      503,
    );
    expect((await PhotoModel.findById(photo.id).lean())?.status).toBe("READY");
    expect((await DELETE(request("DELETE"), params(photo.id))).status).toBe(
      200,
    );
    expect(
      (await POST(request("POST", { ...metadata, objectKey: grant.objectKey })))
        .status,
    ).toBe(404);
  });
  it("publishes one row for concurrent confirmations and cleans the losing copy", async () => {
    const grant = await reserve();
    // Force both requests to inspect PENDING before either can publish, rather
    // than relying on database scheduling (which may legitimately serialize them).
    let release!: () => void;
    const bothCopying = new Promise<void>((resolve) => {
      release = resolve;
    });
    let copying = 0;
    vi.mocked(publishPhotoObject).mockImplementation(async () => {
      copying++;
      if (copying === 2) release();
      await bothCopying;
    });
    const responses = await Promise.all([
      POST(request("POST", { ...metadata, objectKey: grant.objectKey })),
      POST(request("POST", { ...metadata, objectKey: grant.objectKey })),
    ]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(await PhotoModel.countDocuments({ status: "READY" })).toBe(1);
    const keys = vi
      .mocked(publishPhotoObject)
      .mock.calls.map((call) => call[1]);
    const ready = await PhotoModel.findOne({ status: "READY" }).lean();
    expect(keys).toContain(ready?.objectKey);
    expect(new Set(keys).size).toBe(2);
    expect(deletePhotoObject).toHaveBeenCalledWith(
      keys.find((key) => key !== ready?.objectKey),
    );
  });
  it("paginates stably and binds cursors to the wedding and event filter", async () => {
    await publish();
    await publish();
    await publish();
    const first = await (
      await GET(request("GET", undefined, "?limit=2"))
    ).json();
    expect(first.data).toHaveLength(2);
    expect(first.total).toBe(3);
    const second = await (
      await GET(
        request(
          "GET",
          undefined,
          `?limit=2&cursor=${first.pagination.nextCursor}`,
        ),
      )
    ).json();
    expect(second.data).toHaveLength(1);
    expect(second.pagination.nextCursor).toBeNull();
    expect(
      new Set([...first.data, ...second.data].map((photo) => photo.id)).size,
    ).toBe(3);
    expect(
      (
        await GET(
          request(
            "GET",
            undefined,
            `?eventId=other&cursor=${first.pagination.nextCursor}`,
          ),
        )
      ).status,
    ).toBe(400);
    await createSession(b.admin.toString());
    expect(
      (
        await GET(
          request("GET", undefined, `?cursor=${first.pagination.nextCursor}`),
        )
      ).status,
    ).toBe(400);
  });
  it("allows archived-event photos and rejects expired pending uploads", async () => {
    await publish();
    const grant = await reserve();
    await WeddingEventModel.updateOne(
      { _id: a.event },
      { $set: { archivedAt: new Date() } },
    );
    expect(
      (
        await (
          await GET(request("GET", undefined, `?eventId=${a.event}`))
        ).json()
      ).total,
    ).toBe(1);
    await PhotoModel.updateOne(
      { uploadKey: grant.objectKey },
      { $set: { expiresAt: new Date(Date.now() - 86_401_000) } },
    );
    expect(
      (await POST(request("POST", { ...metadata, objectKey: grant.objectKey })))
        .status,
    ).toBe(409);
  });
  it("stops after the member rate limit without consuming the wedding quota", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(new RateLimitError(123));
    const response = await upload(request("POST", metadata));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("123");
    expect(enforceRateLimit).toHaveBeenCalledTimes(1);
    expect(signPhotoUpload).not.toHaveBeenCalled();
  });
  it("rejects malformed and oversized JSON without invoking storage", async () => {
    expect(
      (
        await upload(
          new Request(origin + "/api/photos/upload-url", {
            method: "POST",
            body: "{bad",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await upload(
          new Request(origin + "/api/photos/upload-url", {
            method: "POST",
            body: "x".repeat(4097),
          }),
        )
      ).status,
    ).toBe(413);
    expect(signPhotoUpload).not.toHaveBeenCalled();
  });
});
