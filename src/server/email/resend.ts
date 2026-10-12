import { AppError } from "@/shared/errors";
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
  const response = await fetch("https://api.resend.com/emails", {
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

  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? "Email delivery credentials were rejected. Check the Resend API key and restart the server."
        : response.status === 400
          ? "Resend rejected the sender or recipient. Verify the sender email or domain in Resend."
          : response.status === 429
            ? "Email delivery is temporarily rate-limited. Please try again later."
            : failureMessage;
    throw new AppError("EMAIL_DELIVERY_FAILED", message, 503);
  }
}
