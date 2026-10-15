import { getGuestSummary } from "@/modules/guests/use-cases";
import { errorResponse, successResponse } from "@/server/http/responses";
import { privateGuestResponse, requireGuestContext } from "../context";

export async function GET() {
  try {
    const context = await requireGuestContext();
    return privateGuestResponse(
      successResponse(await getGuestSummary(context.membership.weddingId)),
    );
  } catch (error) {
    return privateGuestResponse(errorResponse(error));
  }
}
