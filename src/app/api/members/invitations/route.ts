import { getAuthContext } from "@/server/auth/context";
import { inviteMemberSchema } from "@/shared/members/schemas";
import { AppError } from "@/shared/errors";
import { errorResponse, successResponse } from "@/server/http/responses";
import { assertSameOrigin } from "@/server/http/request-security";
import { inviteWeddingMember, listPendingMemberInvitations } from "@/modules/members/use-cases";

export async function GET() {
  try {
    const context = await requireAdmin();
    return successResponse(await listPendingMemberInvitations(context.membership.weddingId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdmin();
    const input = inviteMemberSchema.parse(await request.json());
    return successResponse(
      await inviteWeddingMember(context.membership.weddingId, context.user.id, input),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function requireAdmin() {
  const context = await getAuthContext();
  if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
  if (!context.membership || !context.wedding) {
    throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);
  }
  if (context.membership.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Only Admins can manage wedding invitations.", 403);
  }
  return context as NonNullable<typeof context> & {
    membership: NonNullable<NonNullable<typeof context>["membership"]>;
    wedding: NonNullable<NonNullable<typeof context>["wedding"]>;
  };
}
