import { clearSession } from "@/server/auth/session";
import { errorResponse, successFlagResponse } from "@/server/http/responses";
import { assertSameOrigin } from "@/server/http/request-security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await clearSession();
    return successFlagResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
