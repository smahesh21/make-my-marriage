"use client";
// Original private images intentionally bypass the public Next image optimiser/cache.
/* eslint-disable @next/next/no-img-element */
import "./photos.css";
import Link from "next/link";
import { AuthBrand } from "@/app/auth/AuthBrand";
import { useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceSidebar } from "@/app/workspace/WorkspaceSidebar";
import type { Photo, PhotoList } from "@/shared/photos/schemas";
import { PhotoApiError, photoApi } from "./api";
import { PhotoDialog } from "./PhotoDialog";
import { PhotoUploader, type PhotoEvent } from "./PhotoUploader";

type Workspace = {
  user: { id: string };
  membership: {
    id: string;
    weddingId: string;
    role: "ADMIN" | "MANAGER";
  } | null;
  wedding: { brideName: string; groomName: string } | null;
};
const identity = (workspace: Workspace) =>
  `${workspace.user.id}:${workspace.membership?.id}:${workspace.membership?.weddingId}`;
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Unable to load the gallery. Please retry.";
function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  );
}

export default function PhotosPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [photos, setPhotos] = useState<PhotoList | null>(null);
  const [events, setEvents] = useState<PhotoEvent[]>([]);
  const [filter, setFilter] = useState("");
  const [compact, setCompact] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [brokenImage, setBrokenImage] = useState(false);
  const generation = useRef({ value: 0 });
  const owner = useRef<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const requestGeneration = generation.current;
    return () => {
      mounted.current = false;
      requestGeneration.value++;
    };
  }, []);
  const verifyIdentity = useCallback(async () => {
    const result = await photoApi<{ data: Workspace | null }>("/api/auth/me");
    if (!result.data)
      throw new PhotoApiError(
        "Your session has expired. Sign in again, then retry.",
        401,
      );
    const context = result.data;
    if (!context.membership || !context.wedding)
      throw new PhotoApiError(
        "Create a wedding workspace to continue.",
        404,
        "WEDDING_NOT_FOUND",
      );
    const changed =
      owner.current !== null && owner.current !== identity(context);
    owner.current = identity(context);
    if (mounted.current) {
      setWorkspace(context);
      setNeedsSignIn(false);
      if (changed) {
        setUploading(false);
        setViewId(null);
        setPhotos(null);
        setNotice(
          "Your workspace changed. Select photos again in this wedding.",
        );
      }
    }
    return !changed;
  }, []);
  const load = useCallback(
    async (cursor?: string) => {
      const current = ++generation.current.value;
      setLoading(true);
      setError(null);
      try {
        const same = await verifyIdentity();
        if (current !== generation.current.value) return;
        const query = new URLSearchParams({
          limit: "24",
          ...(filter ? { eventId: filter } : {}),
          ...(same && cursor ? { cursor } : {}),
        });
        const [result, ceremonyResult] = await Promise.all([
          photoApi<PhotoList>(`/api/photos?${query}`),
          photoApi<{ data: PhotoEvent[] }>("/api/events?includeArchived=true"),
        ]);
        if (current !== generation.current.value) return;
        setPhotos((previous) =>
          same && cursor && previous
            ? {
                ...result,
                data: [
                  ...previous.data,
                  ...result.data.filter(
                    (photo) =>
                      !previous.data.some((old) => old.id === photo.id),
                  ),
                ],
              }
            : result,
        );
        setEvents(ceremonyResult.data);
      } catch (failure) {
        if (current !== generation.current.value) return;
        setError(message(failure));
        if (failure instanceof PhotoApiError && failure.status === 401)
          setNeedsSignIn(true);
      } finally {
        if (current === generation.current.value) setLoading(false);
      }
    },
    [filter, verifyIdentity],
  );
  useEffect(() => {
    const requestGeneration = generation.current;
    void load();
    return () => {
      requestGeneration.value++;
    };
  }, [load]);
  async function verifyUploadIdentity() {
    const same = await verifyIdentity();
    if (!same) void load();
    return same;
  }
  const selected = photos?.data.find((photo) => photo.id === viewId);
  const index = photos?.data.findIndex((photo) => photo.id === viewId) ?? -1;
  const ceremony = (photo: Photo) =>
    photo.eventId
      ? (events.find((event) => event.id === photo.eventId)?.name ??
        "Wedding event")
      : "Wedding Memories";
  async function download() {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActionError(null);
    try {
      if (!(await verifyIdentity())) {
        void load();
        return;
      }
      const result = await photoApi<{ data: { url: string } }>(
        `/api/photos/${selected.id}/download`,
      );
      const anchor = document.createElement("a");
      anchor.href = result.data.url;
      anchor.download = selected.originalFilename;
      anchor.rel = "noreferrer";
      anchor.click();
    } catch (failure) {
      setActionError(message(failure));
      if (failure instanceof PhotoApiError && failure.status === 401)
        setNeedsSignIn(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function remove() {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActionError(null);
    try {
      if (!(await verifyIdentity())) {
        void load();
        return;
      }
      await photoApi(`/api/photos/${selected.id}`, { method: "DELETE" });
      setViewId(null);
      setDeleting(false);
      setNotice("Photo deleted.");
      void load();
    } catch (failure) {
      setActionError(message(failure));
      if (failure instanceof PhotoApiError && failure.status === 401)
        setNeedsSignIn(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const changeView = (id: string) => {
    setViewId(id);
    setActionError(null);
    setBrokenImage(false);
    setDeleting(false);
  };
  const selectFilter = (value: string) => {
    if (value !== filter) {
      setFilter(value);
      setPhotos(null);
    }
  };
  if (!workspace && !loading)
    return (
      <main className="photos-entry">
        <AuthBrand />
        <h1>Photos &amp; Gallery</h1>
        <p role="alert">
          {error ?? "Sign in to open your private wedding gallery."}
        </p>
        <Link className="button" href="/login?next=%2Fphotos">
          Sign in again
        </Link>
        <button
          className="text-button"
          type="button"
          onClick={() => void load()}
        >
          Retry
        </button>
        <Link className="text-button" href="/onboarding">
          Set up a wedding workspace
        </Link>
      </main>
    );
  return (
    <main className="workspace-page photos-page">
      {workspace ? (
        <WorkspaceSidebar active="photos" />
      ) : (
        <aside
          className="members-sidebar members-sidebar--skeleton"
          aria-hidden="true"
        >
          <span className="members-skeleton members-skeleton--brand" />
        </aside>
      )}
      <section className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <span className="section-eyebrow">
              {workspace?.membership?.role ?? "Wedding"} workspace
            </span>
            <p>
              {workspace?.wedding
                ? `${workspace.wedding.brideName} & ${workspace.wedding.groomName}`
                : "Your wedding memories"}
            </p>
          </div>
          <Link className="text-button" href="/settings/wedding">
            Wedding details
          </Link>
        </header>
        <div className="photos-shell">
          <header className="photos-heading">
            <div>
              <span className="section-eyebrow">Your shared collection</span>
              <h1>Photos &amp; Gallery</h1>
              <p>Collect the moments your wedding circle will remember.</p>
            </div>
            {workspace ? (
              <button
                className="button"
                type="button"
                disabled={needsSignIn}
                onClick={() => setUploading(true)}
              >
                <Icon name="cloud_upload" />
                Upload photos
              </button>
            ) : null}
          </header>
          {notice ? (
            <p className="form-success" role="status">
              {notice}
            </p>
          ) : null}
          {needsSignIn ? (
            <p className="photo-help" role="alert">
              Your session has expired.{" "}
              <a
                href="/login?next=%2Fphotos"
                target={uploading ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                Sign in again
              </a>
              , then refresh or retry. Keep this tab open to preserve selected
              photos.
            </p>
          ) : null}
          {error ? (
            <div className="photo-error" role="alert">
              <h2>We couldn&apos;t refresh your gallery.</h2>
              <p>{error}</p>
              <button
                className="button button--quiet"
                type="button"
                disabled={loading}
                onClick={() => void load()}
              >
                Refresh gallery
              </button>
            </div>
          ) : null}
          {workspace ? (
            <>
              <section className="photos-metrics" aria-label="Gallery summary">
                <article>
                  <span>
                    Collection volume
                    <Icon name="photo_library" />
                  </span>
                  <strong>{photos?.total ?? "—"} photos</strong>
                  <small>
                    {filter
                      ? "In the selected collection"
                      : "Across your wedding celebrations"}
                  </small>
                </article>
                <article>
                  <span>
                    Photo formats
                    <Icon name="image" />
                  </span>
                  <strong>JPEG · PNG · WebP</strong>
                  <small>Original files, without conversion</small>
                </article>
                <article>
                  <span>
                    Upload size
                    <Icon name="cloud_upload" />
                  </span>
                  <strong>10 MiB per photo</strong>
                  <small>Up to 20 photos per batch</small>
                </article>
                <article>
                  <span>
                    Private collection
                    <Icon name="lock" />
                  </span>
                  <strong>Wedding members</strong>
                  <small>Only your Admins and Managers</small>
                </article>
              </section>
              <section className="photos-toolbar" aria-label="Gallery filters">
                <div className="photos-tabs">
                  <button
                    type="button"
                    aria-pressed={!filter}
                    onClick={() => {
                      selectFilter("");
                    }}
                  >
                    All photos
                  </button>
                  {events.map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      aria-pressed={filter === event.id}
                      onClick={() => {
                        selectFilter(event.id);
                      }}
                    >
                      {event.name}
                      {event.archivedAt ? " (archived)" : ""}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={filter === "other"}
                    onClick={() => {
                      selectFilter("other");
                    }}
                  >
                    Wedding Memories
                  </button>
                </div>
                <div className="photos-view">
                  <span>View</span>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Grid view"
                    aria-pressed={!compact}
                    onClick={() => setCompact(false)}
                  >
                    <Icon name="grid_view" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Compact view"
                    aria-pressed={compact}
                    onClick={() => setCompact(true)}
                  >
                    <Icon name="view_module" />
                  </button>
                </div>
              </section>
            </>
          ) : null}
          {loading && !photos ? (
            <div
              className="photos-skeleton"
              role="status"
              aria-label="Loading photos"
            >
              {[0, 1, 2, 3, 4, 5].map((value) => (
                <div key={value} />
              ))}
            </div>
          ) : null}
          {photos?.data.length ? (
            <section
              className={`photos-grid${compact ? " photos-grid--compact" : ""}`}
              aria-label="Wedding photos"
            >
              {photos.data.map((photo, position) => (
                <article
                  key={photo.id}
                  className={
                    !compact && position === 1
                      ? "photo-card photo-card--feature"
                      : "photo-card"
                  }
                >
                  <button
                    type="button"
                    onClick={() => changeView(photo.id)}
                    aria-label={`View ${photo.originalFilename}`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.originalFilename}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                    <span className="photo-card__event">{ceremony(photo)}</span>
                    <div className="photo-card__caption">
                      <strong>{photo.originalFilename}</strong>
                      <span>
                        {new Date(photo.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · {(photo.sizeBytes / 1024 / 1024).toFixed(1)} MiB
                      </span>
                    </div>
                    <span className="photo-card__expand">
                      <Icon name="fullscreen" />
                    </span>
                  </button>
                </article>
              ))}
            </section>
          ) : null}
          {photos && !photos.data.length && !loading ? (
            <section className="photos-empty">
              <Icon name="photo_library" />
              <h2>
                {filter
                  ? "No photos in this collection yet"
                  : "A place for every wedding memory"}
              </h2>
              <p>
                {filter
                  ? "Choose another collection or add photos to this one."
                  : "Add your first photos, from the smallest details to the biggest celebrations."}
              </p>
              <button
                className="button"
                type="button"
                disabled={needsSignIn}
                onClick={() => setUploading(true)}
              >
                Upload photos
              </button>
            </section>
          ) : null}
          {photos?.data.length ? (
            <footer className="photos-pagination">
              <p>
                Showing {photos.data.length} of {photos.total} photos
              </p>
              {photos.pagination.nextCursor ? (
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={loading}
                  onClick={() => void load(photos.pagination.nextCursor!)}
                >
                  {loading ? "Loading…" : "Load more photos"}
                </button>
              ) : null}
              <button
                className="text-button"
                type="button"
                disabled={loading}
                onClick={() => void load()}
              >
                Refresh gallery
              </button>
            </footer>
          ) : null}
          <aside className="photo-help">
            <Icon name="lock" />
            <p>
              Your photos are stored privately. Guest contributions and gallery
              sharing will be available in the next gallery increment.
            </p>
          </aside>
        </div>
      </section>
      {uploading ? (
        <PhotoUploader
          events={events}
          verifyIdentity={verifyUploadIdentity}
          onClose={() => setUploading(false)}
          onSaved={() => {
            void load();
          }}
        />
      ) : null}
      {selected ? (
        <PhotoDialog
          title={deleting ? "Delete this photo?" : "Wedding memory"}
          variant={deleting ? "confirm" : "viewer"}
          onClose={() => {
            if (!busy) {
              if (deleting) setDeleting(false);
              else setViewId(null);
            }
          }}
        >
          <div className="photo-dialog__body">
            {deleting ? (
              <>
                <p>
                  This permanently removes{" "}
                  <strong>{selected.originalFilename}</strong> from your wedding
                  gallery and storage. This cannot be undone.
                </p>
              </>
            ) : (
              <>
                <div className="photo-viewer-image">
                  <img
                    src={selected.url}
                    alt={selected.originalFilename}
                    referrerPolicy="no-referrer"
                    onError={() => setBrokenImage(true)}
                  />
                </div>
                {brokenImage ? (
                  <p className="photo-error" role="alert">
                    This preview may have expired.{" "}
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setViewId(null);
                        void load();
                      }}
                    >
                      Refresh gallery
                    </button>
                  </p>
                ) : null}
                <div className="photo-viewer-meta">
                  <span className="section-eyebrow">{ceremony(selected)}</span>
                  <h3>{selected.originalFilename}</h3>
                  <p>
                    {new Date(selected.createdAt).toLocaleString("en-IN")} ·{" "}
                    {(selected.sizeBytes / 1024 / 1024).toFixed(1)} MiB ·
                    Uploaded by{" "}
                    {selected.uploaderType === "MEMBER"
                      ? "a wedding member"
                      : "a guest"}
                  </p>
                </div>
              </>
            )}
            {actionError ? (
              <p className="form-error" role="alert">
                {actionError}{" "}
                {needsSignIn ? (
                  <a
                    href="/login?next=%2Fphotos"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Sign in again
                  </a>
                ) : null}
              </p>
            ) : null}
          </div>
          <footer className="photo-dialog__footer">
            {deleting ? (
              <>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDeleting(false);
                    setActionError(null);
                  }}
                >
                  Keep photo
                </button>
                <button
                  className="button photo-danger"
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  {busy ? "Deleting…" : "Delete photo"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Previous photo"
                    disabled={busy || index <= 0}
                    onClick={() => changeView(photos!.data[index - 1]!.id)}
                  >
                    <Icon name="chevron_left" />
                  </button>
                  <span>
                    {index + 1} of {photos?.data.length} loaded
                  </span>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Next photo"
                    disabled={busy || index >= (photos?.data.length ?? 0) - 1}
                    onClick={() => changeView(photos!.data[index + 1]!.id)}
                  >
                    <Icon name="chevron_right" />
                  </button>
                </div>
                <div>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={busy}
                    onClick={() => void download()}
                  >
                    <Icon name="download" />
                    Download original
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Delete this photo"
                    disabled={busy}
                    onClick={() => {
                      setDeleting(true);
                      setActionError(null);
                    }}
                  >
                    <Icon name="delete" />
                  </button>
                </div>
              </>
            )}
          </footer>
        </PhotoDialog>
      ) : null}
    </main>
  );
}
