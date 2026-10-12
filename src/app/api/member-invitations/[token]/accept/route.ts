import { getAuthContext } from "@/server/auth/context";
import { acceptMemberInvitation } from "@/modules/members/use-cases";
import { errorResponse, successResponse } from "@/server/http/responses";
import { assertSameOrigin } from "@/server/http/request-security";
import { AppError } from "@/shared/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await getAuthContext();
    if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
    const { token } = await params;
    return successResponse(await acceptMemberInvitation(token, context.user));
  } catch (error) {
    return errorResponse(error);
  }
}
