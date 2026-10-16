import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  S3Client,
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import {
  publishPhotoObject,
  signPhotoRead,
  signPhotoUpload,
} from "@/server/storage/r2";
import { photoFixtures } from "./fixtures/photos";
const metadata = {
  filename: "ceremony.jpg",
  mimeType: "image/jpeg" as const,
  sizeBytes: 120,
  eventId: null,
};
beforeEach(() => {
  vi.stubEnv("R2_ACCOUNT_ID", "00000000000000000000000000000000");
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-only");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-only");
  vi.stubEnv("R2_BUCKET_NAME", "test-bucket");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("R2 photo adapter", () => {
  it("rejects corrupt fixture bytes before copying a PNG", async () => {
    const file = photoFixtures().corrupt;
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValueOnce({
        ContentLength: file.buffer.length,
        ContentType: file.mimeType,
        ETag: '"qa"',
      } as never)
      .mockResolvedValueOnce({
        Body: { transformToByteArray: async () => file.buffer },
      } as never);
    await expect(
      publishPhotoObject("staging/corrupt.png", "final/corrupt.png", {
        filename: file.name,
        mimeType: "image/png",
        sizeBytes: file.buffer.length,
        eventId: null,
      }),
    ).rejects.toMatchObject({ code: "INVALID_PHOTO", status: 400 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(
      send.mock.calls.some(([command]) => command instanceof CopyObjectCommand),
    ).toBe(false);
  });
  it("binds upload type and length and uses short-lived private read URLs", async () => {
    const put = new URL(await signPhotoUpload("staging/photo.jpg", metadata));
    expect(put.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining(["content-type", "content-length", "host"]),
    );
    expect(put.searchParams.get("X-Amz-Expires")).toBe("600");
    const read = new URL(
      await signPhotoRead("final/photo.jpg", "Wedding's photo.jpg"),
    );
    expect(read.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(read.searchParams.get("response-content-disposition")).toContain(
      "attachment;",
    );
    expect(read.searchParams.get("response-cache-control")).toBe(
      "private, no-store",
    );
  });
  it("pins header inspection, signature inspection and copy to the same ETag", async () => {
    const send = vi.spyOn(S3Client.prototype, "send");
    send
      .mockResolvedValueOnce({
        ContentLength: 120,
        ContentType: "image/jpeg",
        ETag: '"version-a"',
      } as never)
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: async () => Uint8Array.from([255, 216, 255]),
        },
      } as never)
      .mockResolvedValueOnce({} as never);
    await publishPhotoObject("staging/photo.jpg", "final/photo.jpg", metadata);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
    const inspect = send.mock.calls[1]?.[0] as GetObjectCommand;
    expect(inspect.input).toMatchObject({
      Range: "bytes=0-15",
      IfMatch: '"version-a"',
    });
    const copy = send.mock.calls[2]?.[0] as CopyObjectCommand;
    expect(copy.input).toMatchObject({
      Key: "final/photo.jpg",
      CopySource: "test-bucket/staging/photo.jpg",
      CopySourceIfMatch: '"version-a"',
    });
  });
  it.each([
    { ContentLength: 121, ContentType: "image/jpeg" },
    { ContentLength: 120, ContentType: "image/png" },
  ])("rejects mismatched R2 metadata without publishing", async (head) => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValueOnce({ ...head, ETag: '"version-a"' } as never);
    await expect(
      publishPhotoObject("staging/photo.jpg", "final/photo.jpg", metadata),
    ).rejects.toMatchObject({ code: "INVALID_PHOTO", status: 400 });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("rejects disguised SVG content and generic provider failures", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValueOnce({
        ContentLength: 120,
        ContentType: "image/jpeg",
        ETag: '"a"',
      } as never)
      .mockResolvedValueOnce({
        Body: { transformToByteArray: async () => Buffer.from("<svg />") },
      } as never);
    await expect(
      publishPhotoObject("staging/a", "final/a", metadata),
    ).rejects.toMatchObject({ code: "INVALID_PHOTO" });
    expect(send).toHaveBeenCalledTimes(2);
    send.mockRejectedValueOnce(new Error("secret provider diagnostics"));
    await expect(
      publishPhotoObject("staging/a", "final/a", metadata),
    ).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      message: "Photo storage is temporarily unavailable. Please retry.",
    });
  });
});
