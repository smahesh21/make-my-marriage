import { signupSchema } from "@/shared/auth/schemas";
import { signup } from "@/modules/auth/use-cases";
import { createSession } from "@/server/auth/session";
import { errorResponse, successResponse } from "@/server/http/responses";
import { assertSameOrigin } from "@/server/http/request-security";
import { AUTH_SIGNUP_RATE_LIMIT, enforceRateLimit } from "@/server/security/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, { name: "auth-signup", ...AUTH_SIGNUP_RATE_LIMIT });
    const input = signupSchema.parse(await request.json());
    const user = await signup(input);
    await createSession(user.id);

    return successResponse({ user, hasWedding: false }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
