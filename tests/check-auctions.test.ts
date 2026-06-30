import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "../lib/env";
import { runAuctionCheck, type AuctionCheckDeps } from "../lib/check-auctions";
import { DEFAULT_AUCTION_FILTERS } from "../lib/filter-settings";
import type { AuctionVehicle } from "../lib/types";

const env = loadEnv({
  CRON_SECRET: "cron-secret",
  TELEGRAM_BOT_TOKEN: "telegram-token",
  TELEGRAM_CHAT_ID: "12345",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
  FIRST_RUN_NOTIFY: "false",
});

describe("runAuctionCheck", () => {
  it("stores first-run matches without sending first-run notifications by default", async () => {
    const vehicle: AuctionVehicle = {
      id: "iaai:stock:45433626",
      source: "iaai",
      title: "2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
      url: "https://www.iaai.com/VehicleDetail/45433626~US",
      year: 2025,
      engine: "1.6L Hybrid",
      interiorColor: "Gray",
      saleDate: "2026-07-07T13:30:00.000Z",
      runStatus: "run_and_drive",
    };
    const deps = makeDeps();

    const summary = await runAuctionCheck({
      env,
      checkedAt: "2026-06-30T08:00:00.000Z",
      sources: [
        {
          source: "iaai",
          enabled: true,
          fetchVehicles: async () => [vehicle],
        },
      ],
      deps,
    });

    expect(summary).toMatchObject({
      ok: true,
      checkedAt: "2026-06-30T08:00:00.000Z",
      totalFound: 1,
      newFound: 0,
      sources: [
        {
          source: "iaai",
          enabled: true,
          ok: true,
          found: 1,
          matched: 1,
          newFound: 0,
        },
      ],
    });
    expect(deps.markSeen).toHaveBeenCalledWith(vehicle);
    expect(deps.sendTelegramAlert).not.toHaveBeenCalled();
    expect(deps.saveLastCheck).toHaveBeenCalledWith(summary);
  });
});

function makeDeps(): AuctionCheckDeps {
  return {
    getStats: vi.fn(async () => ({ seenCount: 0, lastCheck: null })),
    getAuctionFilters: vi.fn(async () => DEFAULT_AUCTION_FILTERS),
    isSeen: vi.fn(async () => false),
    markSeen: vi.fn(async () => undefined),
    saveLastCheck: vi.fn(async () => undefined),
    upsertRecentVehicle: vi.fn(async () => undefined),
    sendTelegramAlert: vi.fn(async () => undefined),
    enrichVehicle: vi.fn(async (vehicle) => vehicle),
    decodeVinValues: vi.fn(async () => null),
  };
}
