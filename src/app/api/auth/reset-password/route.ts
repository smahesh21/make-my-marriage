import { resetPasswordSchema } from "@/shared/auth/schemas";
import { resetPassword } from "@/modules/auth/use-cases";
import { errorResponse, successFlagResponse } from "@/server/http/responses";
import { assertSameOrigin } from "@/server/http/request-security";
import { AUTH_RESET_PASSWORD_RATE_LIMIT, enforceRateLimit } from "@/server/security/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, { name: "auth-reset-password-ip", ...AUTH_RESET_PASSWORD_RATE_LIMIT });
    const input = resetPasswordSchema.parse(await request.json());
    await resetPassword(input);

    return successFlagResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
