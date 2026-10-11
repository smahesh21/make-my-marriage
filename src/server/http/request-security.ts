import { AppError } from "../../shared/errors";

export function assertSameOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");

  if (host && host !== requestUrl.host) {
    throw new AppError("FORBIDDEN_ORIGIN", "This request origin is not allowed.", 403);
  }

  const origin = request.headers.get("origin");
  if (!origin) return;
  if (origin === "null") {
    throw new AppError("FORBIDDEN_ORIGIN", "This request origin is not allowed.", 403);
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new AppError("FORBIDDEN_ORIGIN", "This request origin is not allowed.", 403);
  }

  if (originUrl.origin !== requestUrl.origin) {
    throw new AppError("FORBIDDEN_ORIGIN", "This request origin is not allowed.", 403);
  }
}
