export function getResendFailureMessage(status: number, failureMessage: string) {
  if (status === 401) {
    return "Resend rejected the API key. Update RESEND_API_KEY with an active key and restart the application.";
  }

  if (status === 403) {
    return "Resend rejected the sender or recipient. The onboarding@resend.dev test sender can only deliver to the Resend account email; verify a domain and use its sender address for other recipients.";
  }

  if (status === 400) {
    return "Resend rejected the sender or recipient. Verify the sender email or domain in Resend.";
  }

  if (status === 429) {
    return "Email delivery is temporarily rate-limited. Please try again later.";
  }

  return failureMessage;
}
