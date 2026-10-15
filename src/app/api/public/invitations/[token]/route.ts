import { getPublicInvitation } from "@/modules/guests/invitations";
import { errorResponse, successResponse } from "@/server/http/responses";
import { AppError } from "@/shared/errors";
import { invitationResponse } from "../response";

export async function GET(
  request: Request,
  route: { params: Promise<{ token: string }> },
) {
  try {
    if (new URL(request.url).searchParams.size)
      throw new AppError(
        "VALIDATION_ERROR",
        "This invitation does not accept query parameters.",
        400,
      );
    return invitationResponse(
      successResponse(await getPublicInvitation((await route.params).token)),
    );
  } catch (error) {
    return invitationResponse(errorResponse(error));
  }
}
