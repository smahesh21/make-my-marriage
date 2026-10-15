import { deleteWeddingTask, getWeddingTask, updateWeddingTask } from "@/modules/tasks/use-cases";
import { getAuthContext } from "@/server/auth/context";
import { assertSameOrigin } from "@/server/http/request-security";
import { errorResponse, successFlagResponse, successResponse } from "@/server/http/responses";
import { AppError } from "@/shared/errors";
import { updateTaskSchema } from "@/shared/tasks/schemas";

type RouteContext = { params: Promise<{ taskId: string }> };

async function requireWeddingContext() {
  const context = await getAuthContext();
  if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
  if (!context.membership || !context.wedding) throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);
  return context;
}

export async function GET(_request: Request, routeContext: RouteContext) {
  try {
    const context = await requireWeddingContext();
    const { taskId } = await routeContext.params;
    return successResponse(await getWeddingTask(context.membership!.weddingId, taskId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  try {
    assertSameOrigin(request);
    const context = await requireWeddingContext();
    const { taskId } = await routeContext.params;
    const body = await request.json().catch(() => {
      throw new AppError("VALIDATION_ERROR", "Send a valid JSON request body.", 400);
    });
    const input = updateTaskSchema.parse(body);
    return successResponse(await updateWeddingTask(context.membership!.weddingId, taskId, input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  try {
    assertSameOrigin(request);
    const context = await requireWeddingContext();
    const { taskId } = await routeContext.params;
    await deleteWeddingTask(context.membership!.weddingId, taskId);
    return successFlagResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
