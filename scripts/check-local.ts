import * as nextEnv from "@next/env";
import { chromium } from "playwright";
import { runAuctionCheck, type AuctionCheckSource } from "../lib/check-auctions";
import { getEnvValidationMessage, loadEnv } from "../lib/env";
import {
  fetchLocalCopartVehicles,
  fetchLocalIaaiVehicles,
} from "../lib/providers/playwright-local";

type LocalSourceSelection = "all" | "copart" | "iaai";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());

  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const headless =
    args.headless || process.env.LOCAL_CHECK_HEADLESS?.toLowerCase() === "true";
  const browser = await chromium.launch({ headless });

  try {
    const sources: AuctionCheckSource[] = [
      {
        source: "copart",
        enabled:
          env.ENABLE_COPART &&
          (args.source === "all" || args.source === "copart"),
        fetchVehicles: () => fetchLocalCopartVehicles({ env, browser }),
      },
      {
        source: "iaai",
        enabled:
          env.ENABLE_IAAI && (args.source === "all" || args.source === "iaai"),
        fetchVehicles: () => fetchLocalIaaiVehicles({ env, browser }),
      },
    ];
    const summary = await runAuctionCheck({ env, sources });

    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = summary.ok ? 0 : 1;
  } finally {
    await browser.close();
  }
}

function parseArgs(args: string[]): {
  headless: boolean;
  source: LocalSourceSelection;
} {
  const sourceArg = args
    .find((arg) => arg.startsWith("--source="))
    ?.replace("--source=", "")
    .toLowerCase();
  const source =
    sourceArg === "copart" || sourceArg === "iaai" ? sourceArg : "all";

  return {
    headless: args.includes("--headless"),
    source,
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : getEnvValidationMessage(error));
  if (error instanceof Error && "cause" in error) {
    console.error(error.cause);
  }
  process.exitCode = 1;
});
