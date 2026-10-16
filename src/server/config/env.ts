export class ConfigurationError extends Error {
  constructor(public readonly variable: string) {
    super(`Missing required server configuration: ${variable}`);
    this.name = "ConfigurationError";
  }
}

export function getRequiredEnv(
  name: "MONGODB_URI" | "MONGO_DB_NAME" | "SESSION_SECRET" | "RESEND_API_KEY" | "RESEND_FROM_EMAIL" | "NEXT_PUBLIC_APP_URL" | "R2_ACCOUNT_ID" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET_NAME",
) {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigurationError(name);
  return value;
}
