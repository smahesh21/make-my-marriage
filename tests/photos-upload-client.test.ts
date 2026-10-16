// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { putPhoto } from "@/app/photos/api";

const instances: FakeXHR[] = [];
class FakeXHR {
  status = 200;
  timeout = 0;
  upload = {
    onprogress: null as ((event: Partial<ProgressEvent>) => void) | null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.onabort?.());
  constructor() {
    instances.push(this);
  }
}
beforeEach(() => {
  instances.length = 0;
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
});
afterEach(() => vi.unstubAllGlobals());
const file = () => new File(["synthetic"], "memory.png", { type: "image/png" });

describe("direct upload XHR", () => {
  it("reports measurable byte progress and cleans the abort listener on success", async () => {
    const controller = new AbortController(),
      progress = vi.fn();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const pending = putPhoto(
      "https://storage.example.test/upload",
      file(),
      progress,
      controller.signal,
    );
    const xhr = instances.at(-1)!;
    expect(xhr.open).toHaveBeenCalledWith(
      "PUT",
      "https://storage.example.test/upload",
    );
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      "Content-Type",
      "image/png",
    );
    expect(xhr.timeout).toBe(120_000);
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 1, total: 0 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 4, total: 4 });
    expect(progress.mock.calls.map(([value]) => value)).toEqual([25, 100]);
    xhr.onload?.();
    await expect(pending).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
  it.each(["onerror", "ontimeout", "onabort", "onload"] as const)(
    "reports %s failure without automatically sending again",
    async (handler) => {
      const controller = new AbortController();
      const pending = putPhoto(
        "https://storage.example.test/upload",
        file(),
        vi.fn(),
        controller.signal,
      );
      const xhr = instances.at(-1)!;
      xhr.status = 503;
      xhr[handler]?.();
      await expect(pending).rejects.toMatchObject({
        code: "UPLOAD_INTERRUPTED",
      });
      expect(xhr.send).toHaveBeenCalledTimes(1);
    },
  );
  it("aborts an in-flight upload and does not send an already-cancelled upload", async () => {
    const controller = new AbortController();
    const pending = putPhoto(
      "https://storage.example.test/upload",
      file(),
      vi.fn(),
      controller.signal,
    );
    const xhr = instances.at(-1)!;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "UPLOAD_INTERRUPTED" });
    expect(xhr.abort).toHaveBeenCalledTimes(1);
    const cancelled = putPhoto(
      "https://storage.example.test/upload",
      file(),
      vi.fn(),
      controller.signal,
    );
    await expect(cancelled).rejects.toMatchObject({
      code: "UPLOAD_INTERRUPTED",
    });
    expect(instances.at(-1)!.send).not.toHaveBeenCalled();
  });
});
