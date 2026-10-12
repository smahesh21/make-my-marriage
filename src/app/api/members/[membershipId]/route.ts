import { getAuthContext } from "@/server/auth/context";
import { removeWeddingMember, updateMemberRole } from "@/modules/members/use-cases";
import { errorResponse, successFlagResponse, successResponse } from "@/server/http/responses";
import { assertSameOrigin } from "@/server/http/request-security";
import { updateMemberRoleSchema } from "@/shared/members/schemas";
import { AppError } from "@/shared/errors";
import type { AuthContext } from "@/server/auth/context";

type AdminContext = AuthContext & {
  membership: NonNullable<AuthContext["membership"]>;
  wedding: NonNullable<AuthContext["wedding"]>;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireAdmin();
    const { membershipId } = await params;
    const input = updateMemberRoleSchema.parse(await request.json());
    return successResponse(await updateMemberRole(context.membership.weddingId, membershipId, input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireAdmin();
    const { membershipId } = await params;
    await removeWeddingMember(context.membership.weddingId, membershipId);
    return successFlagResponse();
  } catch (error) {
    return errorResponse(error);
  }
}

async function requireAdmin(): Promise<AdminContext> {
  const context = await getAuthContext();
  if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
  if (!context.membership || !context.wedding) {
    throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);
  }
  if (context.membership.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Only Admins can manage wedding members.", 403);
  }
  return context as AdminContext;
}
