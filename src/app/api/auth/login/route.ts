import { loginSchema } from "@/shared/auth/schemas";
import { login } from "@/modules/auth/use-cases";
import { getAuthContext } from "@/server/auth/context";
import { createSession } from "@/server/auth/session";
import { errorResponse, successResponse } from "@/server/http/responses";
import { assertSameOrigin } from "@/server/http/request-security";
import { AUTH_LOGIN_RATE_LIMIT, enforceRateLimit } from "@/server/security/rate-limit";
import { normalizeEmail } from "@/shared/auth/schemas";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, { name: "auth-login-ip", ...AUTH_LOGIN_RATE_LIMIT });
    const input = loginSchema.parse(await request.json());
    await enforceRateLimit(request, {
      name: "auth-login-email",
      identifier: normalizeEmail(input.email),
      ...AUTH_LOGIN_RATE_LIMIT,
    });
    const user = await login(input);
    await createSession(user.id, input.rememberDevice);
    const context = await getAuthContext();

    return successResponse({ user, hasWedding: Boolean(context?.membership) });
  } catch (error) {
    return errorResponse(error);
  }
}
