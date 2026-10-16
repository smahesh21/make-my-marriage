// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PhotosPage from "@/app/photos/page";
import { PhotoUploader } from "@/app/photos/PhotoUploader";
import { putPhoto } from "@/app/photos/api";
import type { Photo } from "@/shared/photos/schemas";
vi.mock("@/app/workspace/WorkspaceSidebar", () => ({
  WorkspaceSidebar: () => <aside>Workspace navigation</aside>,
}));
vi.mock("@/app/photos/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/photos/api")>()),
  putPhoto: vi.fn(),
}));
const photo: Photo = {
  id: "photo-a",
  eventId: null,
  url: "https://storage.example.test/read",
  originalFilename: "ceremony.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 120,
  uploaderType: "MEMBER",
  createdAt: "2026-10-16T00:00:00Z",
};
let failing: number | null;
let failedConfirm: boolean;
let fetchMock: ReturnType<
  typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>
>;
beforeEach(() => {
  failing = null;
  failedConfirm = false;
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:test-photo");
      static revokeObjectURL = vi.fn();
    },
  );
  vi.mocked(putPhoto).mockReset().mockResolvedValue(undefined);
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, "http://localhost").pathname;
    if (path === "/api/auth/me")
      return Response.json({
        data: {
          user: { id: "admin" },
          membership: { id: "member-a", weddingId: "wedding-a", role: "ADMIN" },
          wedding: { brideName: "Meera", groomName: "Aarav" },
        },
      });
    if (path === "/api/events") return Response.json({ data: [] });
    if (path === "/api/photos/upload-url")
      return Response.json({
        data: {
          objectKey: "test-staging-key",
          uploadUrl: "https://storage.example.test/upload",
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        },
      });
    if (path === "/api/photos" && init?.method === "POST") {
      if (failedConfirm) {
        failedConfirm = false;
        return Response.json(
          { error: { message: "Please retry confirmation." } },
          { status: 503 },
        );
      }
      return Response.json({ data: photo });
    }
    if (path === "/api/photos" && failing)
      return Response.json(
        { error: { message: "Please retry gallery." } },
        { status: failing },
      );
    if (init?.method === "DELETE")
      return Response.json({ data: { success: true } });
    if (path === "/api/photos")
      return Response.json({
        data: [photo],
        total: 1,
        pagination: { nextCursor: null },
      });
    throw Error("Unexpected test endpoint");
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("member gallery", () => {
  it("places navigation and content in separate direct workspace grid columns", async () => {
    const { container } = render(<PhotosPage />);
    await screen.findByRole("button", { name: "View ceremony.jpg" });
    const workspace = screen.getByRole("main");
    const navigation = screen.getByText("Workspace navigation");
    const content = container.querySelector(".workspace-main");
    expect(navigation.parentElement).toBe(workspace);
    expect(content?.parentElement).toBe(workspace);
    expect([...workspace.children]).toEqual([navigation, content]);
    expect(container.querySelector(".workspace-layout")).toBeNull();
  });
  it("does not show workspace navigation to an unauthenticated visitor", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: { message: "Sign in required." } },
        { status: 401 },
      ),
    );
    render(<PhotosPage />);
    expect(
      await screen.findByRole("link", { name: "Sign in again" }),
    ).toBeTruthy();
    expect(screen.queryByText("Workspace navigation")).toBeNull();
  });
  it("renders actual photos, opens a viewer and requires explicit delete confirmation", async () => {
    render(<PhotosPage />);
    const trigger = await screen.findByRole("button", {
      name: "View ceremony.jpg",
    });
    trigger.focus();
    fireEvent.click(trigger);
    const viewer = within(screen.getByRole("dialog"));
    expect(viewer.getByRole("img", { name: "ceremony.jpg" })).toBeTruthy();
    fireEvent.click(viewer.getByRole("button", { name: "Delete this photo" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE"),
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Keep photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Close photo dialog" }));
    expect(document.activeElement).toBe(trigger);
  });
  it.each([401, 500, 503])(
    "provides recovery for status %s without automatic write retries",
    async (status) => {
      failing = status;
      render(<PhotosPage />);
      expect(
        await screen.findByText("We couldn't refresh your gallery."),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Refresh gallery" }),
      ).toBeTruthy();
      expect(fetchMock.mock.calls.some(([, init]) => init?.method)).toBe(false);
      failing = null;
      fireEvent.click(screen.getByRole("button", { name: "Refresh gallery" }));
      expect(
        await screen.findByRole("button", { name: "View ceremony.jpg" }),
      ).toBeTruthy();
    },
  );
  it("does not clear the current collection when its selected filter is clicked", async () => {
    render(<PhotosPage />);
    await screen.findByRole("button", { name: "View ceremony.jpg" });
    fireEvent.click(screen.getByRole("button", { name: "All photos" }));
    expect(
      screen.getByRole("button", { name: "View ceremony.jpg" }),
    ).toBeTruthy();
  });
});
describe("upload drawer", () => {
  const setup = () => {
    const onClose = vi.fn(),
      onSaved = vi.fn();
    render(
      <PhotoUploader
        events={[]}
        onClose={onClose}
        onSaved={onSaved}
        verifyIdentity={async () => true}
      />,
    );
    return { onClose, onSaved };
  };
  function choose(
    file = new File(["image"], "memory.jpg", { type: "image/jpeg" }),
  ) {
    fireEvent.change(screen.getByLabelText("Choose photo files"), {
      target: { files: [file] },
    });
  }
  it("warns before discarding a selected file and restores focus within the dialog", () => {
    const { onClose } = setup();
    choose();
    fireEvent.click(screen.getByRole("button", { name: "Close photo dialog" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Discard unsaved photos" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep uploading" }));
    expect(screen.getByText("memory.jpg")).toBeTruthy();
  });
  it("rejects unsupported and oversized files before making an API request", () => {
    setup();
    choose(new File(["<svg/>"], "vector.svg", { type: "image/svg+xml" }));
    expect(screen.getByText(/Choose a JPEG, PNG or WebP photo/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Upload photos" })).toBeNull();
    choose(
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    );
    expect(
      screen.getAllByText(/Choose a JPEG, PNG or WebP photo/),
    ).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("resends missing staging bytes with the same reservation before confirming again", async () => {
    const original = fetchMock.getMockImplementation()!;
    let missing = true;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/photos" && init?.method === "POST" && missing) {
        missing = false;
        return Response.json(
          { error: { code: "UPLOAD_NOT_FOUND", message: "Upload missing." } },
          { status: 409 },
        );
      }
      return original(url, init);
    });
    const { onSaved } = setup();
    choose();
    fireEvent.click(screen.getByRole("button", { name: "Upload photos" }));
    await screen.findByText("Upload missing.");
    fireEvent.click(screen.getByRole("button", { name: "Retry memory.jpg" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(putPhoto).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/photos/upload-url"),
    ).toHaveLength(1);
  });
  it("requires choosing another file after a definitive invalid-image rejection", async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/photos" && init?.method === "POST")
        return Response.json(
          {
            error: {
              code: "INVALID_PHOTO",
              message: "This file is not a supported photo.",
            },
          },
          { status: 400 },
        );
      return original(url, init);
    });
    setup();
    choose();
    fireEvent.click(screen.getByRole("button", { name: "Upload photos" }));
    await screen.findByText("This file is not a supported photo.");
    expect(
      screen.queryByRole("button", { name: "Retry memory.jpg" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Upload photos" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove memory.jpg" }),
    ).toBeTruthy();
  });
  it("retries an ambiguous confirmation without uploading the binary or reserving again", async () => {
    failedConfirm = true;
    const { onSaved } = setup();
    choose();
    fireEvent.click(screen.getByRole("button", { name: "Upload photos" }));
    await screen.findByText("Please retry confirmation.");
    expect(putPhoto).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry memory.jpg" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(putPhoto).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/photos/upload-url"),
    ).toHaveLength(1);
    expect(screen.getByText(/Added to gallery/)).toBeTruthy();
  });
  it("rejects batches over 20 without dropping the existing selection", () => {
    setup();
    choose();
    fireEvent.change(screen.getByLabelText("Choose photo files"), {
      target: {
        files: Array.from(
          { length: 20 },
          () => new File(["x"], "memory.jpg", { type: "image/jpeg" }),
        ),
      },
    });
    expect(screen.getByText(/Choose at most 20 photos per batch/)).toBeTruthy();
    expect(screen.getAllByText("memory.jpg")).toHaveLength(1);
  });
});
