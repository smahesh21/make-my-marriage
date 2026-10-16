export class PhotoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "PhotoApiError";
  }
}
// Do not replay mutations automatically; a failed response may conceal a completed write.
export async function photoApi<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: init?.signal ?? AbortSignal.timeout(30_000),
    });
  } catch {
    throw new PhotoApiError(
      "Unable to connect. Check your connection and retry.",
      0,
      "NETWORK_ERROR",
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new PhotoApiError(
      payload?.error?.message ||
        (response.status === 401
          ? "Your session has expired. Sign in again, then retry."
          : "Unable to complete this photo request. Please retry."),
      response.status,
      payload?.error?.code,
      Number(response.headers.get("Retry-After")) || undefined,
    );
  if (!payload || typeof payload !== "object" || !("data" in payload))
    throw new PhotoApiError(
      "Unexpected server response. Refresh the gallery and retry.",
      response.status,
      "INVALID_RESPONSE",
    );
  return payload as T;
}
export function putPhoto(
  url: string,
  file: File,
  onProgress: (value: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fail = () =>
      reject(
        new PhotoApiError(
          "Upload interrupted. Retry this photo; already saved photos will not be uploaded again.",
          0,
          "UPLOAD_INTERRUPTED",
        ),
      );
    const abort = () => xhr.abort();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      signal.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else fail();
    };
    xhr.onerror =
      xhr.ontimeout =
      xhr.onabort =
        () => {
          signal.removeEventListener("abort", abort);
          fail();
        };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      signal.removeEventListener("abort", abort);
      fail();
      return;
    }
    xhr.send(file);
  });
}
