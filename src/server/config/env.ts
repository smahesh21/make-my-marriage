export class ConfigurationError extends Error {
  constructor(variable: string) {
    super(`Missing required server configuration: ${variable}`);
    this.name = "ConfigurationError";
  }
}

export function getRequiredEnv(
  name: "MONGODB_URI" | "MONGO_DB_NAME" | "SESSION_SECRET" | "RESEND_API_KEY" | "RESEND_FROM_EMAIL" | "NEXT_PUBLIC_APP_URL",
) {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigurationError(name);
  return value;
}
