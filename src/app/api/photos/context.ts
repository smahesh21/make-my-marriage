import { getAuthContext } from "@/server/auth/context";
import { AppError } from "@/shared/errors";

export async function requirePhotoContext() {
  const context = await getAuthContext();
  if (!context)
    throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
  if (!context.membership || !context.wedding)
    throw new AppError(
      "WEDDING_NOT_FOUND",
      "Create a wedding workspace to continue.",
      404,
    );
  if (!["ADMIN", "MANAGER"].includes(context.membership.role))
    throw new AppError("FORBIDDEN", "Wedding membership is required.", 403);
  return { membership: context.membership };
}
export function privatePhotoResponse<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
export async function readPhotoJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError(
      "VALIDATION_ERROR",
      "Send a valid JSON request body.",
      400,
    );
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new AppError(
          "PAYLOAD_TOO_LARGE",
          "Photo metadata must be smaller than 4 KiB.",
          413,
        );
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "VALIDATION_ERROR",
      "Send a valid JSON request body.",
      400,
    );
  } finally {
    reader.releaseLock();
  }
}
