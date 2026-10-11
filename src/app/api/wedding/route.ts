import { createWeddingSchema, updateWeddingSchema } from "@/shared/wedding/schemas";
import { AppError } from "@/shared/errors";
import { getAuthContext } from "@/server/auth/context";
import { errorResponse, successResponse } from "@/server/http/responses";
import { createWeddingForUser, updateWeddingForMember } from "@/modules/wedding/use-cases";
import { assertSameOrigin } from "@/server/http/request-security";

export async function GET() {
  try {
    const context = await getAuthContext();
    if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
    if (!context.wedding) throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);
    return successResponse(context.wedding);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await getAuthContext();
    if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
    const input = createWeddingSchema.parse(await request.json());
    const wedding = await createWeddingForUser(context.user.id, input);
    return successResponse(wedding, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await getAuthContext();
    if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
    if (!context.wedding || !context.membership) {
      throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);
    }
    if (context.membership.role !== "ADMIN" && context.membership.role !== "MANAGER") {
      throw new AppError("FORBIDDEN", "You do not have permission to edit wedding details.", 403);
    }

    const input = updateWeddingSchema.parse(await request.json());
    const wedding = await updateWeddingForMember(context.membership.weddingId, input);
    return successResponse(wedding);
  } catch (error) {
    return errorResponse(error);
  }
}
