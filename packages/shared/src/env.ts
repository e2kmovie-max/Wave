import { z } from "zod";

/**
 * Validated, type-safe access to environment variables shared across apps.
 *
 * Each app extends this with its own additional vars where needed.
 */
const baseSchema = z.object({
  MONGODB_URI: z
    .string()
    .min(1)
    .default("mongodb://wave:wave@localhost:27017/wave?authSource=admin"),
  APP_SECRET: z.string().min(16).default("dev-only-app-secret-replace-me-please"),
  PUBLIC_WEB_URL: z.string().url().default("http://localhost:3000"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  BOT_TOKEN: z.string().optional().default(""),
  BOT_USERNAME: z.string().optional().default(""),

  ADMIN_TELEGRAM_IDS: z
    .string()
    .optional()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n)),
    ),
});

export type WaveEnv = z.infer<typeof baseSchema>;

let cached: WaveEnv | null = null;

export function getEnv(): WaveEnv {
  if (cached) return cached;
  const parsed = baseSchema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldErrors = JSON.stringify(flat.fieldErrors, null, 2);
    throw new Error(`Invalid environment variables:\n${fieldErrors}`);
  }
  cached = parsed.data;
  return cached;
}

export function isGoogleOAuthConfigured(env = getEnv()): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function isBotConfigured(env = getEnv()): boolean {
  return Boolean(env.BOT_TOKEN);
}
