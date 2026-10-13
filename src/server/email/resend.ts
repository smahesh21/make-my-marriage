import { AppError } from "@/shared/errors";
import { getResendFailureMessage } from "@/shared/email/errors";
import { ConfigurationError, getRequiredEnv } from "@/server/config/env";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function assertEmailDeliveryConfigured() {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  if (apiKey === "replace-with-your-resend-api-key" || apiKey.startsWith("your_")) {
    throw new ConfigurationError("RESEND_API_KEY");
  }
  getRequiredEnv("RESEND_FROM_EMAIL");
  getRequiredEnv("NEXT_PUBLIC_APP_URL");
}

export async function sendEmailThroughResend(
  input: SendEmailInput,
  failureMessage = "We couldn't send the email. Please try again later.",
) {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getRequiredEnv("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getRequiredEnv("RESEND_FROM_EMAIL"),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
  } catch {
    throw new AppError("EMAIL_DELIVERY_FAILED", failureMessage, 503);
  }

  if (!response.ok) {
    throw new AppError("EMAIL_DELIVERY_FAILED", getResendFailureMessage(response.status, failureMessage), 503);
  }
}
