import { archiveWeddingEvent, getWeddingEvent, updateWeddingEvent } from "@/modules/events/use-cases";
import { getAuthContext } from "@/server/auth/context";
import { assertSameOrigin } from "@/server/http/request-security";
import { errorResponse, successFlagResponse, successResponse } from "@/server/http/responses";
import { AppError } from "@/shared/errors";
import { updateEventSchema } from "@/shared/events/schemas";

type RouteContext = { params: Promise<{ eventId: string }> };

async function requireWeddingContext() {
  const context = await getAuthContext();
  if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
  if (!context.membership || !context.wedding) throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);
  return context;
}

export async function GET(_request: Request, routeContext: RouteContext) {
  try {
    const context = await requireWeddingContext();
    const { eventId } = await routeContext.params;
    return successResponse(await getWeddingEvent(context.membership!.weddingId, eventId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  try {
    assertSameOrigin(request);
    const context = await requireWeddingContext();
    const { eventId } = await routeContext.params;
    const input = updateEventSchema.parse(await request.json());
    return successResponse(await updateWeddingEvent(context.membership!.weddingId, eventId, input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  try {
    assertSameOrigin(request);
    const context = await requireWeddingContext();
    const { eventId } = await routeContext.params;
    await archiveWeddingEvent(context.membership!.weddingId, eventId);
    return successFlagResponse();
  } catch (error) {
    return errorResponse(error);
  }
}

