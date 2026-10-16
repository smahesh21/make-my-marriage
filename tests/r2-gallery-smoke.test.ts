import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { expect, it } from "vitest";
import {
  deletePhotoObject,
  publishPhotoObject,
  signPhotoRead,
  signPhotoUpload,
} from "@/server/storage/r2";

// Explicit opt-in only. Never run against production; never touch app objects or MongoDB.
it.skipIf(process.env.RUN_R2_SMOKE !== "1")(
  "round-trips a disposable development photo through signed upload, verification, copy, and download",
  async () => {
    // Next's loader intentionally skips .env.local under NODE_ENV=test.
    loadEnvFile(".env.local");
    if (process.env.R2_BUCKET_NAME !== "make-my-marriage-develop")
      throw Error("R2 smoke test requires the development bucket.");
    const prefix = `test-fixtures/gallery-${randomUUID()}/`;
    const staging = `${prefix}staging.png`,
      final = `${prefix}final.png`;
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XcAAAAASUVORK5CYII=",
      "base64",
    );
    const input = {
      filename: "fixture.png",
      mimeType: "image/png" as const,
      sizeBytes: bytes.length,
      eventId: null,
    };
    try {
      const uploadUrl = await signPhotoUpload(staging, input);
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": input.mimeType },
        body: bytes,
        signal: AbortSignal.timeout(20_000),
      });
      expect(put.status).toBe(200);
      await publishPhotoObject(staging, final, input);
      const readUrl = await signPhotoRead(final, input.filename);
      const read = await fetch(readUrl, {
        signal: AbortSignal.timeout(20_000),
      });
      expect(read.status).toBe(200);
      expect(read.headers.get("Content-Disposition")).toContain("attachment");
      expect(Buffer.from(await read.arrayBuffer()).equals(bytes)).toBe(true);
      // Replaying the original staging URL must not replace the independent final object.
      const replay = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": input.mimeType },
        body: Buffer.alloc(bytes.length),
        signal: AbortSignal.timeout(20_000),
      });
      expect(replay.status).toBe(200);
      const afterReplay = await fetch(await signPhotoRead(final), {
        signal: AbortSignal.timeout(20_000),
      });
      expect(Buffer.from(await afterReplay.arrayBuffer()).equals(bytes)).toBe(
        true,
      );
      // Wrong content type fails the signature, not just application validation.
      const invalid = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: bytes,
        signal: AbortSignal.timeout(20_000),
      });
      expect(invalid.status).toBe(403);
    } finally {
      if (!staging.startsWith(prefix) || !final.startsWith(prefix))
        throw Error("Refusing out-of-scope test cleanup.");
      await Promise.all([deletePhotoObject(staging), deletePhotoObject(final)]);
    }
  },
  120_000,
);
