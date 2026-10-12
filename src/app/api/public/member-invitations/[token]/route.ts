import { getPublicMemberInvitation } from "@/modules/members/use-cases";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    return successResponse(await getPublicMemberInvitation(token));
  } catch (error) {
    return errorResponse(error);
  }
}
