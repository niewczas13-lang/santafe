import { describe, expect, it } from "vitest";
import { loadEnv } from "../lib/env";
import {
  buildCopartActorInput,
  buildIaaiActorInput,
} from "../lib/providers/shared";

const requiredEnv = {
  CRON_SECRET: "cron-secret",
  TELEGRAM_BOT_TOKEN: "telegram-token",
  TELEGRAM_CHAT_ID: "12345",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
  APIFY_TOKEN: "apify-token",
};

describe("provider actor input builders", () => {
  it("builds Copart actor input with the required startUrl", () => {
    const env = loadEnv(requiredEnv);

    expect(buildCopartActorInput(env)).toEqual({
      startUrl:
        "https://www.copart.com/lotSearchResults/?free=true&query=hyundai%20santa%20fe%20calligraphy",
      maxItems: 200,
    });
  });

  it("prefers configured Copart saved-search URLs", () => {
    const env = loadEnv({
      ...requiredEnv,
      COPART_SEARCH_URLS: "https://www.copart.com/lotSearchResults/?free=true&query=saved",
    });

    expect(buildCopartActorInput(env)).toMatchObject({
      startUrl: "https://www.copart.com/lotSearchResults/?free=true&query=saved",
    });
  });

  it("builds IAAI actor input with the required URLs array", () => {
    const env = loadEnv(requiredEnv);

    expect(buildIaaiActorInput(env)).toEqual({
      urls: [
        "https://www.iaai.com/Search?Keyword=hyundai%20santa%20fe%20calligraphy",
      ],
      maxitems: 200,
    });
  });

  it("prefers configured IAAI saved-search URLs", () => {
    const env = loadEnv({
      ...requiredEnv,
      IAAI_SEARCH_URLS:
        "https://www.iaai.com/Search?Keyword=saved,https://www.iaai.com/Search?Keyword=second",
    });

    expect(buildIaaiActorInput(env)).toMatchObject({
      urls: [
        "https://www.iaai.com/Search?Keyword=saved",
        "https://www.iaai.com/Search?Keyword=second",
      ],
    });
  });
});
