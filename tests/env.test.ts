import { describe, expect, it } from "vitest";
import { loadEnv } from "../lib/env";

const requiredEnv = {
  CRON_SECRET: "cron-secret",
  TELEGRAM_BOT_TOKEN: "telegram-token",
  TELEGRAM_CHAT_ID: "12345",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
};

describe("loadEnv", () => {
  it("defaults Apify actor IDs when APIFY_TOKEN is provided", () => {
    const env = loadEnv({
      ...requiredEnv,
      APIFY_TOKEN: "apify-token",
    });

    expect(env.APIFY_COPART_ACTOR_ID).toBe(
      "parseforge/copart-public-search-scraper",
    );
    expect(env.APIFY_IAAI_ACTOR_ID).toBe(
      "delectable_incubator/iaai-vehicles-scraper-low-cost",
    );
  });

  it("lets explicit Apify actor env vars override defaults", () => {
    const env = loadEnv({
      ...requiredEnv,
      APIFY_TOKEN: "apify-token",
      APIFY_COPART_ACTOR_ID: "custom/copart",
      APIFY_IAAI_ACTOR_ID: "custom/iaai",
    });

    expect(env.APIFY_COPART_ACTOR_ID).toBe("custom/copart");
    expect(env.APIFY_IAAI_ACTOR_ID).toBe("custom/iaai");
  });

  it("does not set Apify actor defaults without APIFY_TOKEN", () => {
    const env = loadEnv(requiredEnv);

    expect(env.APIFY_COPART_ACTOR_ID).toBeUndefined();
    expect(env.APIFY_IAAI_ACTOR_ID).toBeUndefined();
  });

  it("accepts Vercel Upstash integration variable names", () => {
    const env = loadEnv({
      CRON_SECRET: "cron-secret",
      TELEGRAM_BOT_TOKEN: "telegram-token",
      TELEGRAM_CHAT_ID: "12345",
      UPSTASH_REDIS_REST_KV_REST_API_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_KV_REST_API_TOKEN: "redis-token",
    });

    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://example.upstash.io");
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBe("redis-token");
  });
});
