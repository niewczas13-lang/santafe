import { z } from "zod";

export const DEFAULT_COPART_ACTOR_ID = "parseforge/copart-public-search-scraper";
export const DEFAULT_IAAI_ACTOR_ID =
  "delectable_incubator/iaai-vehicles-scraper-low-cost";

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

const booleanEnv = (defaultValue: boolean) =>
  z
    .preprocess((value) => {
      if (typeof value === "boolean") {
        return value;
      }

      if (typeof value !== "string" || value.trim() === "") {
        return defaultValue;
      }

      return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
    }, z.boolean())
    .default(defaultValue);

const integerEnv = (defaultValue: number) =>
  z
    .preprocess((value) => {
      if (typeof value === "number") {
        return value;
      }

      if (typeof value !== "string" || value.trim() === "") {
        return defaultValue;
      }

      return Number.parseInt(value, 10);
    }, z.number().int().positive())
    .default(defaultValue);

const nonnegativeIntegerEnv = (defaultValue: number) =>
  z
    .preprocess((value) => {
      if (typeof value === "number") {
        return value;
      }

      if (typeof value !== "string" || value.trim() === "") {
        return defaultValue;
      }

      return Number.parseInt(value, 10);
    }, z.number().int().nonnegative())
    .default(defaultValue);

const csvEnv = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}, z.array(z.string().url()));

const rawEnvSchema = z.object({
  CRON_SECRET: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  MIN_YEAR: integerEnv(2024),
  ENABLE_COPART: booleanEnv(true),
  ENABLE_IAAI: booleanEnv(true),
  COPART_SEARCH_URLS: csvEnv.default([]),
  IAAI_SEARCH_URLS: csvEnv.default([]),
  APIFY_TOKEN: optionalString,
  APIFY_COPART_ACTOR_ID: optionalString,
  APIFY_IAAI_ACTOR_ID: optionalString,
  FIRST_RUN_NOTIFY: booleanEnv(false),
  MAX_RESULTS_PER_SOURCE: integerEnv(200),
  COPART_DETAIL_PAGE_LIMIT: nonnegativeIntegerEnv(8),
  COPART_DETAIL_DELAY_MS: nonnegativeIntegerEnv(2500),
  ENABLE_DEBUG_ROUTES: booleanEnv(false),
});

export type AppEnv = z.infer<typeof rawEnvSchema>;

export function loadEnv(
  input: Record<string, string | undefined> = process.env,
): AppEnv {
  const parsed = rawEnvSchema.parse(normalizeEnvAliases(input));

  return {
    ...parsed,
    APIFY_COPART_ACTOR_ID:
      parsed.APIFY_TOKEN && !parsed.APIFY_COPART_ACTOR_ID
        ? DEFAULT_COPART_ACTOR_ID
        : parsed.APIFY_COPART_ACTOR_ID,
    APIFY_IAAI_ACTOR_ID:
      parsed.APIFY_TOKEN && !parsed.APIFY_IAAI_ACTOR_ID
        ? DEFAULT_IAAI_ACTOR_ID
        : parsed.APIFY_IAAI_ACTOR_ID,
  };
}

function normalizeEnvAliases(
  input: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return {
    ...input,
    UPSTASH_REDIS_REST_URL:
      input.UPSTASH_REDIS_REST_URL ??
      input.UPSTASH_REDIS_REST_KV_REST_API_URL ??
      input.KV_REST_API_URL,
    UPSTASH_REDIS_REST_TOKEN:
      input.UPSTASH_REDIS_REST_TOKEN ??
      input.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ??
      input.KV_REST_API_TOKEN,
  };
}

export function getEnvValidationMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
  }

  return error instanceof Error ? error.message : "Unknown environment error";
}
