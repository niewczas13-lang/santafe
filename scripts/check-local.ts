import * as nextEnv from "@next/env";
import { getEnvValidationMessage, loadEnv } from "../lib/env";
import { runLocalAuctionCheck } from "../lib/local-check-runner";

type LocalSourceSelection = "all" | "copart" | "iaai";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());

  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const headless =
    args.headless || process.env.LOCAL_CHECK_HEADLESS?.toLowerCase() === "true";
  const summary = await runLocalAuctionCheck({
    env,
    source: args.source,
    headless,
  });

  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
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
