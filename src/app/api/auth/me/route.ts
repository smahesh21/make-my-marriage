import { getAuthContext } from "@/server/auth/context";
import { AppError } from "@/shared/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET() {
  try {
    const context = await getAuthContext();
    if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
    return successResponse(context);
  } catch (error) {
    return errorResponse(error);
  }
}
