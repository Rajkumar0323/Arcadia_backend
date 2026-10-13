import "dotenv/config";

const required = ["DATABASE_URL", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"];
for (const key of required) {
  if (!process.env[key]) console.warn(`[env] Missing ${key} — the API will not work correctly until it is set.`);
}

const list = (v?: string) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  frontendUrls: list(process.env.FRONTEND_URL ?? "http://localhost:3000"),
  adminEmails: list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  autoFinalize: process.env.AUTO_FINALIZE_SEASONS !== "false",
};

export const isDev = env.nodeEnv !== "production";
