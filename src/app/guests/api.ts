type ErrorPayload = { code?: string; message?: string; fields?: Record<string, string[]> };

export class GuestApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string, public readonly fields?: Record<string, string[]>, public readonly retryAfterSeconds?: number) {
    super(message);
    this.name = "GuestApiError";
  }
}

// No automatic write retries: a lost response does not mean the write failed.
export async function requestGuestApi<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(20_000) });
  } catch (error) {
    const timeout = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    throw new GuestApiError(timeout ? "The request took too long. Please try again." : "We couldn't connect. Check your connection and try again.", 0, timeout ? "REQUEST_TIMEOUT" : "NETWORK_ERROR");
  }
  const payload: unknown = await response.json().catch(() => null);
  const body = payload !== null && typeof payload === "object" ? payload as Record<string, unknown> : null;
  if (!response.ok) {
    const error = body?.error as ErrorPayload | undefined;
    const retry = Number(response.headers.get("Retry-After"));
    throw new GuestApiError(typeof error?.message === "string" ? error.message : response.status === 401 ? "Your session has expired. Sign in again, then retry." : "Unable to complete this request. Please try again.", response.status, error?.code, error?.fields, Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  if (!body || (!("data" in body) && body.success !== true)) throw new GuestApiError("The server returned an unexpected response. Please refresh before trying again.", response.status, "INVALID_RESPONSE");
  return body as T;
}
