import { AppError } from "@/shared/errors";
import { getRequiredEnv } from "@/server/config/env";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function assertEmailDeliveryConfigured() {
  getRequiredEnv("RESEND_API_KEY");
  getRequiredEnv("RESEND_FROM_EMAIL");
  getRequiredEnv("NEXT_PUBLIC_APP_URL");
}

export async function sendEmailThroughResend(input: SendEmailInput) {
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
    throw new AppError("EMAIL_DELIVERY_FAILED", "We couldn't send the password reset email. Please try again later.", 503);
  }
}
