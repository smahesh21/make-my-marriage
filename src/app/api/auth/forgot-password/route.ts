import { forgotPasswordSchema, normalizeEmail } from "@/shared/auth/schemas";
import { requestPasswordReset } from "@/modules/auth/use-cases";
import { errorResponse, successFlagResponse } from "@/server/http/responses";
import { assertSameOrigin } from "@/server/http/request-security";
import { AUTH_FORGOT_PASSWORD_RATE_LIMIT, enforceRateLimit } from "@/server/security/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, { name: "auth-forgot-password-ip", ...AUTH_FORGOT_PASSWORD_RATE_LIMIT });
    const input = forgotPasswordSchema.parse(await request.json());
    await enforceRateLimit(request, {
      name: "auth-forgot-password-email",
      identifier: normalizeEmail(input.email),
      ...AUTH_FORGOT_PASSWORD_RATE_LIMIT,
    });
    await requestPasswordReset(input);

    return successFlagResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
