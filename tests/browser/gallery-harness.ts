import { expect, type Page, type Route } from "@playwright/test";
import type { Photo } from "../../src/shared/photos/schemas";
import { tinyPng } from "../fixtures/photos";

export function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

export async function galleryHarness(
  page: Page,
  role: "ADMIN" | "MANAGER" = "ADMIN",
) {
  const state = {
    role,
    signedIn: true,
    listFailures: 0,
    listNetworkFailures: 0,
    putFailures: 0,
    confirmationFailures: 0,
    missingUploads: 0,
    deleteFailures: 0,
    puts: 0,
    reservations: 0,
    confirmations: 0,
    deletions: 0,
    downloads: 0,
    putGate: null as ReturnType<typeof gate> | null,
    confirmGate: null as ReturnType<typeof gate> | null,
    photos: [] as Photo[],
    unexpected: [] as string[],
  };
  const grants = new Map<
    string,
    {
      filename: string;
      mimeType: string;
      sizeBytes: number;
      eventId: string | null;
    }
  >();
  const json = (route: Route, data: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  const failure = (route: Route, code = "STORAGE_UNAVAILABLE", status = 503) =>
    json(
      route,
      { error: { code, message: "Synthetic failure. Please retry." } },
      status,
    );
  // Fail closed for APIs. The actual browser XHR, DOM, CSS and event handlers run.
  // No real session or provider request can escape this isolated test context.
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (url.origin !== "http://127.0.0.1:3002")
      return route.abort("blockedbyclient");
    if (path === "/__qa_storage/read")
      return route.fulfill({ contentType: "image/png", body: tinyPng });
    if (path === "/__qa_storage/download")
      return route.fulfill({
        contentType: "image/png",
        headers: { "Content-Disposition": 'attachment; filename="memory.png"' },
        body: tinyPng,
      });
    if (
      path.startsWith("/__qa_storage/upload/") &&
      request.method() === "PUT"
    ) {
      state.puts++;
      if (state.putGate) await state.putGate.promise;
      if (state.putFailures-- > 0) return failure(route);
      return route.fulfill({ status: 200, body: "" });
    }
    if (!path.startsWith("/api/")) return route.continue();
    if (path === "/api/auth/me")
      return json(route, {
        data: state.signedIn
          ? {
              user: { id: "qa-user" },
              membership: {
                id: "qa-member",
                weddingId: "qa-wedding",
                role: state.role,
              },
              wedding: { brideName: "QA Bride", groomName: "QA Groom" },
            }
          : null,
      });
    if (!state.signedIn) return failure(route, "UNAUTHENTICATED", 401);
    if (path === "/api/events")
      return json(route, {
        data: [
          {
            id: "aaaaaaaaaaaaaaaaaaaaaaaa",
            name: "QA Ceremony",
            archivedAt: null,
          },
        ],
      });
    if (path === "/api/photos/upload-url" && request.method() === "POST") {
      const metadata = request.postDataJSON();
      const key = `synthetic-${++state.reservations}`;
      grants.set(key, metadata);
      return json(
        route,
        {
          data: {
            objectKey: key,
            uploadUrl: `${url.origin}/__qa_storage/upload/${key}`,
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        },
        201,
      );
    }
    if (path === "/api/photos" && request.method() === "POST") {
      state.confirmations++;
      if (state.confirmGate) await state.confirmGate.promise;
      if (state.confirmationFailures-- > 0) return failure(route);
      if (state.missingUploads-- > 0)
        return failure(route, "UPLOAD_NOT_FOUND", 409);
      const input = request.postDataJSON();
      const metadata = grants.get(input.objectKey);
      if (!metadata) return failure(route, "UPLOAD_NOT_FOUND", 404);
      if (metadata.filename === "corrupt.png")
        return failure(route, "INVALID_PHOTO", 400);
      let photo = state.photos.find((item) => item.id === input.objectKey);
      if (!photo) {
        photo = {
          id: input.objectKey,
          eventId: metadata.eventId,
          originalFilename: metadata.filename,
          mimeType: metadata.mimeType as Photo["mimeType"],
          sizeBytes: metadata.sizeBytes,
          url: `${url.origin}/__qa_storage/read`,
          uploaderType: "MEMBER",
          createdAt: new Date().toISOString(),
        };
        state.photos.push(photo);
      }
      return json(route, { data: photo }, 201);
    }
    if (path === "/api/photos" && request.method() === "GET") {
      if (state.listNetworkFailures-- > 0)
        return route.abort("connectionreset");
      if (state.listFailures-- > 0) return failure(route);
      const filter = url.searchParams.get("eventId");
      const data = state.photos.filter(
        (item) =>
          !filter ||
          (filter === "other" ? !item.eventId : item.eventId === filter),
      );
      return json(route, {
        data,
        total: data.length,
        pagination: { nextCursor: null },
      });
    }
    if (path.startsWith("/api/photos/") && request.method() === "DELETE") {
      state.deletions++;
      if (state.deleteFailures-- > 0) return failure(route);
      state.photos = state.photos.filter(
        (item) => item.id !== path.split("/").at(-1),
      );
      return json(route, { data: { deleted: true } });
    }
    if (path.startsWith("/api/photos/") && path.endsWith("/download")) {
      state.downloads++;
      return json(route, {
        data: { url: `${url.origin}/__qa_storage/download` },
      });
    }
    state.unexpected.push(`${request.method()} ${path}`);
    return failure(route, "UNEXPECTED_TEST_REQUEST", 500);
  });
  await page.goto("/photos");
  await expect(
    page.getByRole("heading", { name: "Photos & Gallery", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A place for every wedding memory" }),
  ).toBeVisible();
  return state;
}

export async function openUploader(page: Page) {
  await page
    .getByRole("button", { name: "Upload photos", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Upload photos",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}
