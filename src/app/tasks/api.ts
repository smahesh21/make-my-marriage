type ErrorPayload = { code?: string; message?: string };

export class TaskApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "TaskApiError";
  }
}

// Task writes are deliberately never retried automatically: a lost response can
// mean the write succeeded, especially when creating a task.
export async function requestTaskApi<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(20_000) });
  } catch (error) {
    const timedOut = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    throw new TaskApiError(
      timedOut ? "The request took too long. Please try again." : "We couldn't connect. Check your connection and try again.",
      0,
      timedOut ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
    );
  }

  // Status handling must survive HTML/empty error responses from a proxy or an
  // expired session, rather than being hidden by a JSON parsing exception.
  const payload: unknown = await response.json().catch(() => null);
  const body = payload !== null && typeof payload === "object" ? payload as Record<string, unknown> : null;
  if (!response.ok) {
    const error = body?.error as ErrorPayload | undefined;
    const fallback = response.status === 401
      ? "Your session has expired. Sign in again, then retry."
      : "Unable to complete this request. Please try again.";
    throw new TaskApiError(typeof error?.message === "string" ? error.message : fallback, response.status, error?.code);
  }
  if (!body || (!("data" in body) && body.success !== true)) {
    throw new TaskApiError("The server returned an unexpected response. Please try again.", response.status, "INVALID_RESPONSE");
  }
  return body as T;
}
