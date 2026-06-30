import { chromium } from "playwright";
import { runAuctionCheck, type AuctionCheckSource } from "./check-auctions";
import type { AppEnv } from "./env";
import {
  fetchLocalCopartVehicles,
  fetchLocalIaaiVehicles,
} from "./providers/playwright-local";
import type { CronCheckSummary } from "./types";
import type { ManualCheckSource } from "./manual-check";

export type LocalCheckOptions = {
  env: AppEnv;
  source?: ManualCheckSource;
  headless?: boolean;
};

export async function runLocalAuctionCheck({
  env,
  source = "all",
  headless = false,
}: LocalCheckOptions): Promise<CronCheckSummary> {
  const browser = await chromium.launch({ headless });

  try {
    const sources: AuctionCheckSource[] = [
      {
        source: "copart",
        enabled: env.ENABLE_COPART && (source === "all" || source === "copart"),
        fetchVehicles: () => fetchLocalCopartVehicles({ env, browser }),
      },
      {
        source: "iaai",
        enabled: env.ENABLE_IAAI && (source === "all" || source === "iaai"),
        fetchVehicles: () => fetchLocalIaaiVehicles({ env, browser }),
      },
    ];

    return await runAuctionCheck({ env, sources });
  } finally {
    await browser.close();
  }
}
