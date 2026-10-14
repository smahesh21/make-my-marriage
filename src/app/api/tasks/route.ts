import { createWeddingTask, listWeddingTasks } from "@/modules/tasks/use-cases";
import { getAuthContext } from "@/server/auth/context";
import { assertSameOrigin } from "@/server/http/request-security";
import { errorResponse, successResponse } from "@/server/http/responses";
import { AppError } from "@/shared/errors";
import { createTaskSchema, taskListQuerySchema } from "@/shared/tasks/schemas";

async function requireWeddingContext() {
  const context = await getAuthContext();
  if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
  if (!context.membership || !context.wedding) throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);
  return context;
}

export async function GET(request: Request) {
  try {
    const context = await requireWeddingContext();
    const url = new URL(request.url);
    const query = taskListQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    return successResponse(await listWeddingTasks(context.membership!.weddingId, context.membership!.id, query));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireWeddingContext();
    const input = createTaskSchema.parse(await request.json());
    return successResponse(await createWeddingTask(context.membership!.weddingId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
