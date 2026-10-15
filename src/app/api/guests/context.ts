import { getAuthContext } from "@/server/auth/context";
import { AppError } from "@/shared/errors";

export async function requireGuestContext() {
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
  return {
    ...context,
    membership: context.membership,
    wedding: context.wedding,
  };
}

export async function readGuestJson(
  request: Request,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): Promise<unknown> {
  if (!request.body) {
    if (allowEmpty) return {};
    throw new AppError(
      "VALIDATION_ERROR",
      "Send a valid JSON request body.",
      400,
    );
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new AppError(
          "PAYLOAD_TOO_LARGE",
          "Guest details must be smaller than 8 KiB.",
          413,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    const body = text + decoder.decode();
    // Next.js can expose a zero-byte POST as a readable stream. Only command
    // routes opt into empty bodies; guest CRUD and RSVP still require JSON.
    if (allowEmpty && body.length === 0) return {};
    return JSON.parse(body);
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

export function privateGuestResponse<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
