import { getInvitationLink } from "@/modules/guests/invitations";
import { errorResponse, successResponse } from "@/server/http/responses";
import { privateGuestResponse, requireGuestContext } from "../../context";

export async function GET(
  _request: Request,
  route: { params: Promise<{ guestId: string }> },
) {
  try {
    const context = await requireGuestContext();
    return privateGuestResponse(
      successResponse(
        await getInvitationLink(
          context.membership.weddingId,
          (await route.params).guestId,
        ),
      ),
    );
  } catch (error) {
    return privateGuestResponse(errorResponse(error));
  }
}
