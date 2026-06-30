import * as nextEnv from "@next/env";
import { spawn } from "child_process";
import path from "path";
import { loadEnv } from "../lib/env";
import {
  claimManualCheckRequest,
  markManualCheckRequestFailed,
  markManualCheckRequestFinished,
  markManualCheckRequestRunning,
} from "../lib/manual-check";
import { getStats } from "../lib/storage";

const DEFAULT_INTERVAL_SECONDS = 15;
const CHECK_TIMEOUT_MS = 30 * 60 * 1000;

async function main() {
  nextEnv.loadEnvConfig(process.cwd());

  loadEnv();
  const intervalMs = getPollIntervalMs();
  const headless = process.env.LOCAL_LISTENER_HEADLESS?.toLowerCase() !== "false";

  console.log(
    `[${new Date().toISOString()}] Local manual check listener started; polling every ${
      intervalMs / 1000
    }s.`,
  );

  let idlePolls = 0;

  while (true) {
    const request = await claimNextRequest();

    if (!request) {
      idlePolls += 1;
      if (idlePolls % 4 === 0) {
        console.log(`[${new Date().toISOString()}] Listener idle.`);
      }
      await sleep(intervalMs);
      continue;
    }

    idlePolls = 0;
    console.log(
      `[${new Date().toISOString()}] Claimed manual check ${request.id} (${request.source}).`,
    );

    try {
      await bestEffortStatusUpdate(
        markManualCheckRequestRunning(request),
        "mark running",
      );
      await runManualCheckProcess(request.source, headless);
      const summary = (await getStats()).lastCheck ?? {
        ok: false,
        checkedAt: new Date().toISOString(),
        totalFound: 0,
        newFound: 0,
        sources: [],
      };
      await bestEffortStatusUpdate(
        markManualCheckRequestFinished(request, summary),
        "mark finished",
      );
      console.log(
        `[${new Date().toISOString()}] Finished ${request.id}: ok=${
          summary.ok
        }, matched=${summary.totalFound}, new=${summary.newFound}.`,
      );
    } catch (error) {
      await bestEffortStatusUpdate(
        markManualCheckRequestFailed(request, error),
        "mark failed",
      );
      console.error(
        `[${new Date().toISOString()}] Manual check ${request.id} failed:`,
        error,
      );
    }
  }
}

async function runManualCheckProcess(
  source: "all" | "copart" | "iaai",
  headless: boolean,
): Promise<void> {
  const runner = path.join(process.cwd(), "scripts", "run-local-check.ps1");
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    runner,
    "-Source",
    source,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn("powershell.exe", args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LOCAL_CHECK_HEADLESS: headless ? "true" : "false",
      },
      windowsHide: false,
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Local check timed out after ${CHECK_TIMEOUT_MS}ms`));
    }, CHECK_TIMEOUT_MS);

    child.stdout.on("data", (data) => process.stdout.write(data));
    child.stderr.on("data", (data) => process.stderr.write(data));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Local check process exited with code ${code}`));
    });
  });
}

async function claimNextRequest() {
  try {
    return await withTimeout(claimManualCheckRequest(), 15_000);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Failed to poll manual check queue:`,
      error,
    );
    return null;
  }
}

async function bestEffortStatusUpdate(
  action: Promise<unknown>,
  label: string,
): Promise<void> {
  try {
    await withTimeout(action, 10_000);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Could not ${label} for manual check:`,
      error,
    );
  }
}

async function withTimeout<T>(
  action: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      action,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function getPollIntervalMs(): number {
  const parsed = Number.parseInt(
    process.env.LOCAL_LISTENER_INTERVAL_SECONDS ?? "",
    10,
  );

  return (
    (Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_SECONDS) *
    1000
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
