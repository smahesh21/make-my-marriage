"use client";
// In-memory file previews are not public, remotely optimisable image assets.
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  MAX_PHOTO_BATCH,
  photoUploadSchema,
  type PhotoUpload,
} from "@/shared/photos/schemas";
import { PhotoApiError, photoApi, putPhoto } from "./api";
import { PhotoDialog } from "./PhotoDialog";

export type PhotoEvent = {
  id: string;
  name: string;
  archivedAt: string | null;
};
type Grant = { uploadUrl: string; objectKey: string; expiresAt: string };
type QueueItem = {
  id: string;
  file: File;
  preview: string | null;
  input: PhotoUpload | null;
  status: "queued" | "uploading" | "confirming" | "saved" | "failed";
  progress: number;
  error?: string;
  grant?: Grant;
  uploaded?: boolean;
};
export function PhotoUploader({
  events,
  onClose,
  onSaved,
  verifyIdentity,
}: {
  events: PhotoEvent[];
  onClose: () => void;
  onSaved: () => void;
  verifyIdentity: () => Promise<boolean>;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const itemsRef = useRef(items);
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const previews = useRef(new Set<string>());
  const mounted = useRef(true);
  const update = (id: string, patch: Partial<QueueItem>) => {
    itemsRef.current = itemsRef.current.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    if (mounted.current) setItems(itemsRef.current);
  };
  useEffect(() => {
    mounted.current = true;
    const previewUrls = previews.current;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      for (const url of previewUrls) URL.revokeObjectURL(url);
    };
  }, []);
  const unsaved = items.some((item) => item.status !== "saved");
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  function choose(files: File[]) {
    if (running.current) return;
    if (itemsRef.current.length + files.length > MAX_PHOTO_BATCH) {
      setNotice(
        "Choose at most 20 photos per batch. Remove a photo before adding more.",
      );
      return;
    }
    const added = files.map((file) => {
      const result = photoUploadSchema.safeParse({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        eventId: eventId || null,
      });
      const preview = result.success ? URL.createObjectURL(file) : null;
      if (preview) previews.current.add(preview);
      return {
        id: crypto.randomUUID(),
        file,
        preview,
        input: result.success ? result.data : null,
        progress: 0,
        status: result.success ? "queued" : "failed",
        error: result.success
          ? undefined
          : "Choose a JPEG, PNG or WebP photo up to 10 MiB. The extension must match its format.",
      } as QueueItem;
    });
    itemsRef.current = [...itemsRef.current, ...added];
    setItems(itemsRef.current);
    setNotice(null);
  }
  function select(event: ChangeEvent<HTMLInputElement>) {
    choose(Array.from(event.target.files ?? []));
    event.target.value = "";
  }
  function remove(id: string) {
    const item = itemsRef.current.find((item) => item.id === id);
    if (item?.preview) {
      URL.revokeObjectURL(item.preview);
      previews.current.delete(item.preview);
    }
    itemsRef.current = itemsRef.current.filter((item) => item.id !== id);
    setItems(itemsRef.current);
  }
  const close = () => {
    if (unsaved || running.current) setDiscard(true);
    else onClose();
  };
  async function run(onlyId?: string) {
    if (running.current || Date.now() < retryAt) return;
    running.current = true;
    setBusy(true);
    setNotice(null);
    setNeedsSignIn(false);
    controller.current = new AbortController();
    try {
      if (!(await verifyIdentity()) || !mounted.current) return;
      for (const original of itemsRef.current.filter(
        (item) =>
          item.input &&
          item.status !== "saved" &&
          (!onlyId || item.id === onlyId),
      )) {
        if (controller.current.signal.aborted || !mounted.current) break;
        const input = original.input!;
        let grant = original.grant;
        let uploaded = original.uploaded ?? false;
        try {
          if (
            !grant ||
            (!uploaded && Date.parse(grant.expiresAt) <= Date.now())
          ) {
            const result = await photoApi<{ data: Grant }>(
              "/api/photos/upload-url",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
                signal: controller.current.signal,
              },
            );
            grant = result.data;
            uploaded = false;
            update(original.id, { grant, uploaded: false });
          }
          if (!uploaded) {
            update(original.id, {
              status: "uploading",
              progress: 0,
              error: undefined,
            });
            await putPhoto(
              grant.uploadUrl,
              original.file,
              (progress) => update(original.id, { progress }),
              controller.current.signal,
            );
            uploaded = true;
            update(original.id, { uploaded: true, progress: 100 });
          }
          update(original.id, { status: "confirming", error: undefined });
          await photoApi("/api/photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...input, objectKey: grant.objectKey }),
            signal: controller.current.signal,
          });
          update(original.id, {
            status: "saved",
            progress: 100,
            error: undefined,
          });
          onSaved();
        } catch (error) {
          if (!mounted.current) break;
          const apiError = error instanceof PhotoApiError ? error : null;
          update(original.id, {
            status: "failed",
            error:
              error instanceof Error
                ? error.message
                : "Upload failed. Please retry.",
            ...(apiError?.code === "UPLOAD_EXPIRED"
              ? { grant: undefined, uploaded: false }
              : {}),
            // A definitive missing staging object needs its bytes again. Keep
            // the reservation so an ambiguous publication is never duplicated.
            ...(apiError?.code === "UPLOAD_NOT_FOUND"
              ? { uploaded: false }
              : {}),
            // Retrying unchanged, rejected bytes cannot repair an invalid image.
            ...(apiError?.code === "INVALID_PHOTO" ? { input: null } : {}),
          });
          if (apiError?.status === 401) {
            setNeedsSignIn(true);
            break;
          }
          if (apiError?.status === 429) {
            setRetryAt(Date.now() + (apiError.retryAfter ?? 60) * 1000);
            break;
          }
          if (controller.current.signal.aborted) break;
        }
      }
    } catch (error) {
      setNeedsSignIn(error instanceof PhotoApiError && error.status === 401);
      setNotice(
        error instanceof Error
          ? error.message
          : "Please sign in again and retry.",
      );
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const saved = items.filter((item) => item.status === "saved").length;
  const seconds = Math.max(0, Math.ceil((retryAt - clock) / 1000));
  return (
    <PhotoDialog title="Upload photos" onClose={close}>
      <div className="photo-dialog__body">
        <p className="photo-help">
          JPEG, PNG and WebP · up to 10 MiB per photo · maximum 20 per batch.
          Videos, SVG and HEIC are not supported.
        </p>
        <label className="photo-field">
          Assign to wedding event (optional)
          <select
            value={eventId}
            disabled={busy || items.length > 0}
            onChange={(event) => setEventId(event.target.value)}
          >
            <option value="">Wedding Memories</option>
            {events
              .filter((event) => !event.archivedAt)
              .map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
          </select>
        </label>
        {items.length ? (
          <p className="photo-small">
            Event choice is saved with this batch. Start a new batch to choose
            another event.
          </p>
        ) : null}
        <div
          className="photo-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            choose(Array.from(event.dataTransfer.files));
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            cloud_upload
          </span>
          <p>
            Drag &amp; drop photos here
            <br />
            or browse from your device
          </p>
          <button
            className="button button--quiet"
            disabled={busy || items.length >= MAX_PHOTO_BATCH}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            Choose photos
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choose photo files"
            onChange={select}
            hidden
          />
        </div>
        {notice ? (
          <p className="form-error" role="alert">
            {notice}
          </p>
        ) : null}
        {needsSignIn ? (
          <p className="photo-help" role="alert">
            Sign in again in another tab, then retry. Keep this window open to
            retain your photos.{" "}
            <a
              href="/login?next=%2Fphotos"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sign in
            </a>
          </p>
        ) : null}
        {seconds ? (
          <p className="photo-help" role="status">
            Upload limit reached. Retry in {seconds} seconds.
          </p>
        ) : null}
        <div className="photo-queue-heading">
          <span>Queue ({items.length} photos)</span>
          {!busy && items.some((item) => item.status === "failed") ? (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                for (const item of itemsRef.current.filter(
                  (item) => item.status === "failed",
                ))
                  remove(item.id);
              }}
            >
              Clear failed
            </button>
          ) : null}
        </div>
        <ul className="photo-queue">
          {items.map((item) => (
            <li
              key={item.id}
              className={item.status === "failed" ? "has-error" : ""}
            >
              {item.preview ? (
                <img src={item.preview} alt="" width={48} height={48} />
              ) : (
                <span className="material-symbols-outlined" aria-hidden="true">
                  broken_image
                </span>
              )}
              <div>
                <strong>{item.file.name}</strong>
                <span>
                  {item.status === "saved"
                    ? "Added to gallery"
                    : item.status === "confirming"
                      ? "Finalizing…"
                      : item.status === "uploading"
                        ? `Uploading… ${item.progress}%`
                        : item.status === "failed"
                          ? "Upload failed"
                          : "Ready to upload"}{" "}
                  · {(item.file.size / 1024 / 1024).toFixed(1)} MiB
                </span>
                {item.status === "uploading" || item.status === "confirming" ? (
                  <progress
                    max={100}
                    value={item.status === "confirming" ? 100 : item.progress}
                    aria-label={`Upload progress for ${item.file.name}`}
                  />
                ) : null}
                {item.error ? <p role="alert">{item.error}</p> : null}
                {item.status === "failed" && item.input ? (
                  <button
                    className="text-button"
                    type="button"
                    disabled={busy || seconds > 0}
                    onClick={() => void run(item.id)}
                  >
                    Retry {item.file.name}
                  </button>
                ) : null}
              </div>
              {item.status !== "saved" ? (
                <button
                  className="icon-button"
                  type="button"
                  disabled={busy}
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => remove(item.id)}
                >
                  <span
                    className="material-symbols-outlined"
                    aria-hidden="true"
                  >
                    close
                  </span>
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="photo-help">
          Keep this window open while uploading. Selected files are not retained
          after closing or refreshing this tab.
        </p>
        {discard ? (
          <div className="photo-discard" role="alert">
            <p>
              Discard unsaved photos? Photos already saved will stay in your
              gallery.
            </p>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setDiscard(false)}
            >
              Keep uploading
            </button>
            <button
              className="button"
              type="button"
              onClick={() => {
                controller.current?.abort();
                onClose();
              }}
            >
              Discard unsaved photos
            </button>
          </div>
        ) : null}
      </div>
      <footer className="photo-dialog__footer">
        <span role="status">
          {saved} of {items.length} saved to gallery
        </span>
        <div>
          <button
            className="button button--quiet"
            type="button"
            onClick={close}
          >
            {saved === items.length && saved > 0
              ? "Done / View in gallery"
              : "Cancel"}
          </button>
          {items.some((item) => item.input && item.status !== "saved") ? (
            <button
              className="button"
              type="button"
              disabled={busy || seconds > 0}
              onClick={() => void run()}
            >
              {busy ? "Uploading…" : "Upload photos"}
            </button>
          ) : null}
        </div>
      </footer>
    </PhotoDialog>
  );
}
