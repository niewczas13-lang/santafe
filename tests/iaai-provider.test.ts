import { afterEach, describe, expect, it, vi } from "vitest";
import { runActor } from "../lib/apify";
import { loadEnv } from "../lib/env";
import { fetchIaaiVehicles } from "../lib/providers/iaai";

vi.mock("../lib/apify", () => ({
  runActor: vi.fn(),
}));

const requiredEnv = {
  CRON_SECRET: "cron-secret",
  TELEGRAM_BOT_TOKEN: "telegram-token",
  TELEGRAM_CHAT_ID: "12345",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
  APIFY_TOKEN: "apify-token",
};

describe("fetchIaaiVehicles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("falls back to IAAI search HTML when the Apify actor returns no vehicles", async () => {
    vi.mocked(runActor).mockResolvedValue([]);
    const fetchMock = vi.fn(async () => {
      return new Response(
        `
          <article>
            <a href="/VehicleDetail/45433626~US" aria-label="image"></a>
            <h4>
              <a href="/VehicleDetail/45433626~US" name="45433626">
                2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY
              </a>
            </h4>
          </article>
        `,
        {
          headers: { "content-type": "text/html; charset=utf-8" },
          status: 200,
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const vehicles = await fetchIaaiVehicles({ env: loadEnv(requiredEnv) });

    expect(fetchMock).toHaveBeenCalled();
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]).toMatchObject({
      id: "iaai:stock:45433626",
      source: "iaai",
      stockNumber: "45433626",
      title: "2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
      url: "https://www.iaai.com/VehicleDetail/45433626~US",
      imageUrl:
        "https://vis.iaai.com/resizer?imageKeys=45433626~SID~I1&width=640&height=480",
    });
  });

  it("tries the detail-capable IAAI actor before direct search HTML", async () => {
    const runActorMock = vi.mocked(runActor);
    runActorMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          stockNumber: "45495976",
          title: "2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
          url: "https://www.iaai.com/VehicleDetail/45495976~US",
          auctionDateTime: "2026-07-07T13:30:00.000Z",
        },
      ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const vehicles = await fetchIaaiVehicles({ env: loadEnv(requiredEnv) });

    expect(runActorMock).toHaveBeenNthCalledWith(
      1,
      "delectable_incubator/iaai-vehicles-scraper-low-cost",
      {
        urls: [
          "https://www.iaai.com/Search?Keyword=hyundai%20santa%20fe%20calligraphy",
        ],
        maxitems: 200,
      },
      { token: "apify-token", timeoutMs: 35_000 },
    );
    expect(runActorMock).toHaveBeenNthCalledWith(
      2,
      "lulzasaur/iaa-scraper",
      {
        keyword: "hyundai santa fe calligraphy",
        maxResults: 200,
        scrapeDetails: true,
      },
      { token: "apify-token", timeoutMs: undefined },
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]).toMatchObject({
      id: "iaai:stock:45495976",
      saleDate: "2026-07-07T13:30:00.000Z",
    });
  });
});
