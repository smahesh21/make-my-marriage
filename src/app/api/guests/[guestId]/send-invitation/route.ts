import { z } from "zod";
import { sendGuestInvitation } from "@/modules/guests/invitations";
import { assertSameOrigin } from "@/server/http/request-security";
import { errorResponse, successFlagResponse } from "@/server/http/responses";
import {
  privateGuestResponse,
  readGuestJson,
  requireGuestContext,
} from "../../context";

export async function POST(
  request: Request,
  route: { params: Promise<{ guestId: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireGuestContext();
    z.object({})
      .strict()
      .parse(await readGuestJson(request, { allowEmpty: true }));
    await sendGuestInvitation(
      context.membership.weddingId,
      (await route.params).guestId,
      "invitation",
      request,
    );
    return privateGuestResponse(successFlagResponse());
  } catch (error) {
    return privateGuestResponse(errorResponse(error));
  }
}
