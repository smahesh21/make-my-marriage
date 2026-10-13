import { createWeddingEvent, listWeddingEvents } from "@/modules/events/use-cases";
import { getAuthContext } from "@/server/auth/context";
import { assertSameOrigin } from "@/server/http/request-security";
import { errorResponse, successResponse } from "@/server/http/responses";
import { AppError } from "@/shared/errors";
import { createEventSchema, eventListQuerySchema } from "@/shared/events/schemas";

export async function GET(request: Request) {
  try {
    const context = await getAuthContext();
    if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
    if (!context.membership || !context.wedding) throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);

    const url = new URL(request.url);
    const query = eventListQuerySchema.parse({
      includeArchived: url.searchParams.get("includeArchived") ?? "false",
      ...(url.searchParams.get("from") ? { from: url.searchParams.get("from") } : {}),
      ...(url.searchParams.get("to") ? { to: url.searchParams.get("to") } : {}),
    });
    return successResponse(await listWeddingEvents(context.membership.weddingId, query));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await getAuthContext();
    if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
    if (!context.membership || !context.wedding) throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);
    const input = createEventSchema.parse(await request.json());
    return successResponse(await createWeddingEvent(context.membership.weddingId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

