import { deleteGuest, getGuest, updateGuest } from "@/modules/guests/use-cases";
import { assertSameOrigin } from "@/server/http/request-security";
import {
  errorResponse,
  successFlagResponse,
  successResponse,
} from "@/server/http/responses";
import { updateGuestSchema } from "@/shared/guests/schemas";
import {
  privateGuestResponse,
  readGuestJson,
  requireGuestContext,
} from "../context";

type RouteContext = { params: Promise<{ guestId: string }> };

export async function GET(_request: Request, route: RouteContext) {
  try {
    const context = await requireGuestContext();
    return privateGuestResponse(
      successResponse(
        await getGuest(
          context.membership.weddingId,
          (await route.params).guestId,
        ),
      ),
    );
  } catch (error) {
    return privateGuestResponse(errorResponse(error));
  }
}

export async function PATCH(request: Request, route: RouteContext) {
  try {
    assertSameOrigin(request);
    const context = await requireGuestContext();
    const input = updateGuestSchema.parse(await readGuestJson(request));
    return privateGuestResponse(
      successResponse(
        await updateGuest(
          context.membership.weddingId,
          (await route.params).guestId,
          input,
        ),
      ),
    );
  } catch (error) {
    return privateGuestResponse(errorResponse(error));
  }
}

export async function DELETE(request: Request, route: RouteContext) {
  try {
    assertSameOrigin(request);
    const context = await requireGuestContext();
    await deleteGuest(
      context.membership.weddingId,
      (await route.params).guestId,
    );
    return privateGuestResponse(successFlagResponse());
  } catch (error) {
    return privateGuestResponse(errorResponse(error));
  }
}
