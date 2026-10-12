import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, RateLimitError } from "@/shared/errors";
import { ConfigurationError } from "@/server/config/env";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function successFlagResponse(status = 200) {
  return NextResponse.json({ success: true }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check the highlighted fields.",
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    const response = NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
    if (error instanceof RateLimitError) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return response;
  }

  if (error instanceof ConfigurationError) {
    const message = error.variable.startsWith("RESEND_")
      ? "Email delivery is not configured yet. Add the Resend server variables and restart the application."
      : "The wedding workspace is not configured yet. Add the server environment variables and try again.";

    return NextResponse.json(
      {
        error: {
          code: "SERVER_NOT_CONFIGURED",
          message,
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    { status: 500 },
  );
}
