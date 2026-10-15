import { submitRsvp } from "@/modules/guests/invitations";
import { readGuestJson } from "@/app/api/guests/context";
import { assertSameOrigin } from "@/server/http/request-security";
import { errorResponse, successResponse } from "@/server/http/responses";
import { AppError } from "@/shared/errors";
import { rsvpSchema } from "@/shared/guests/invitations";
import { invitationResponse } from "../../response";

export async function POST(
  request: Request,
  route: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    if (new URL(request.url).searchParams.size)
      throw new AppError(
        "VALIDATION_ERROR",
        "This invitation does not accept query parameters.",
        400,
      );
    const input = rsvpSchema.parse(await readGuestJson(request));
    return invitationResponse(
      successResponse(
        await submitRsvp((await route.params).token, input, request),
      ),
    );
  } catch (error) {
    return invitationResponse(errorResponse(error));
  }
}
