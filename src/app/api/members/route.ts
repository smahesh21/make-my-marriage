import { getAuthContext } from "@/server/auth/context";
import { errorResponse, successResponse } from "@/server/http/responses";
import { AppError } from "@/shared/errors";
import { listWeddingMembers } from "@/modules/members/use-cases";

export async function GET() {
  try {
    const context = await getAuthContext();
    if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
    if (!context.membership || !context.wedding) {
      throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);
    }

    return successResponse(await listWeddingMembers(context.membership.weddingId));
  } catch (error) {
    return errorResponse(error);
  }
}
