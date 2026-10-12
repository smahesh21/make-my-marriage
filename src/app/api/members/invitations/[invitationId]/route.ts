import { getAuthContext } from "@/server/auth/context";
import { revokeMemberInvitation } from "@/modules/members/use-cases";
import { errorResponse, successFlagResponse } from "@/server/http/responses";
import { assertSameOrigin } from "@/server/http/request-security";
import { AppError } from "@/shared/errors";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await getAuthContext();
    if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
    if (!context.membership || !context.wedding) {
      throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);
    }
    if (context.membership.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only Admins can manage wedding invitations.", 403);
    }

    const { invitationId } = await params;
    await revokeMemberInvitation(context.membership.weddingId, invitationId);
    return successFlagResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
