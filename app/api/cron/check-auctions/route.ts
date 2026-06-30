import { NextResponse } from "next/server";
import { getEnvValidationMessage, loadEnv, type AppEnv } from "@/lib/env";
import {
  matchesSantaFeCalligraphy,
  vehicleClearlyMentionsCalligraphy,
} from "@/lib/filter";
import { fetchCopartVehicles } from "@/lib/providers/copart";
import { fetchIaaiVehicles } from "@/lib/providers/iaai";
import { decodeVinValues } from "@/lib/vin";
import { getStats, isSeen, markSeen, saveLastCheck } from "@/lib/storage";
import { sendTelegramAlert } from "@/lib/telegram";
import type {
  AuctionSource,
  AuctionVehicle,
  CronCheckSummary,
  SourceCheckSummary,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let env: AppEnv;

  try {
    env = loadEnv();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getEnvValidationMessage(error) },
      { status: 500 },
    );
  }

  if (!isAuthorized(request, env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const sourceSummaries: SourceCheckSummary[] = [];
  let totalFound = 0;
  let newFound = 0;

  const stats = await getStats();
  const isFirstRun = stats.seenCount === 0;

  const sources: Array<{
    source: AuctionSource;
    enabled: boolean;
    fetchVehicles: () => Promise<AuctionVehicle[]>;
  }> = [
    {
      source: "copart",
      enabled: env.ENABLE_COPART,
      fetchVehicles: () => fetchCopartVehicles({ env }),
    },
    {
      source: "iaai",
      enabled: env.ENABLE_IAAI,
      fetchVehicles: () => fetchIaaiVehicles({ env }),
    },
  ];

  for (const sourceConfig of sources) {
    if (!sourceConfig.enabled) {
      sourceSummaries.push({
        source: sourceConfig.source,
        enabled: false,
        ok: true,
        found: 0,
        matched: 0,
        newFound: 0,
      });
      continue;
    }

    try {
      const vehicles = await sourceConfig.fetchVehicles();
      const matches = await filterMatchesWithOptionalVinDecode(vehicles, env);
      const unseen: AuctionVehicle[] = [];

      for (const vehicle of matches) {
        if (!(await isSeen(vehicle.id))) {
          unseen.push(vehicle);
        }
      }

      const shouldNotify = !isFirstRun || env.FIRST_RUN_NOTIFY;
      for (const vehicle of unseen) {
        if (shouldNotify) {
          await sendTelegramAlert(vehicle, env);
          newFound += 1;
        }

        await markSeen(vehicle);
      }

      totalFound += matches.length;
      sourceSummaries.push({
        source: sourceConfig.source,
        enabled: true,
        ok: true,
        found: vehicles.length,
        matched: matches.length,
        newFound: shouldNotify ? unseen.length : 0,
      });
    } catch (error) {
      sourceSummaries.push({
        source: sourceConfig.source,
        enabled: true,
        ok: false,
        found: 0,
        matched: 0,
        newFound: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary: CronCheckSummary = {
    ok: sourceSummaries.every((source) => source.ok),
    checkedAt,
    totalFound,
    newFound,
    sources: sourceSummaries,
  };

  await saveLastCheck(summary);
  return NextResponse.json(summary);
}

function isAuthorized(request: Request, cronSecret: string): boolean {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authorization = request.headers.get("authorization");
  const bearerSecret = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  return querySecret === cronSecret || bearerSecret === cronSecret;
}

async function filterMatchesWithOptionalVinDecode(
  vehicles: AuctionVehicle[],
  env: AppEnv,
): Promise<AuctionVehicle[]> {
  const matches: AuctionVehicle[] = [];

  for (const vehicle of vehicles) {
    let decodedTrim: string | undefined;

    if (vehicle.vin && !vehicleClearlyMentionsCalligraphy(vehicle)) {
      try {
        const decoded = await decodeVinValues(vehicle.vin);
        decodedTrim = [decoded?.trim, decoded?.series].filter(Boolean).join(" ");
      } catch {
        decodedTrim = undefined;
      }
    }

    if (matchesSantaFeCalligraphy(vehicle, { minYear: env.MIN_YEAR, decodedTrim })) {
      matches.push(vehicle);
    }
  }

  return matches;
}
