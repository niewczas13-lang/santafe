import type { AppEnv } from "./env";
import {
  matchesAuctionFilters,
  matchesSantaFeCalligraphy,
  vehicleClearlyMentionsCalligraphy,
} from "./filter";
import { enrichVehicleImage } from "./listing-image";
import {
  getAuctionFilters,
  getStats,
  isSeen,
  markSeen,
  saveLastCheck,
  upsertRecentVehicle,
} from "./storage";
import { sendTelegramAlert } from "./telegram";
import type {
  AuctionFilters,
  AuctionSource,
  AuctionVehicle,
  CronCheckSummary,
  DashboardStats,
  SourceCheckSummary,
} from "./types";
import { decodeVinValues } from "./vin";

export type AuctionCheckSource = {
  source: AuctionSource;
  enabled: boolean;
  fetchVehicles: () => Promise<AuctionVehicle[]>;
};

export type AuctionCheckDeps = {
  getStats: () => Promise<DashboardStats>;
  getAuctionFilters: () => Promise<AuctionFilters>;
  isSeen: (id: string) => Promise<boolean>;
  markSeen: (vehicle: AuctionVehicle) => Promise<void>;
  saveLastCheck: (summary: CronCheckSummary) => Promise<void>;
  upsertRecentVehicle: (vehicle: AuctionVehicle) => Promise<void>;
  sendTelegramAlert: (vehicle: AuctionVehicle, env: AppEnv) => Promise<void>;
  enrichVehicle: (vehicle: AuctionVehicle) => Promise<AuctionVehicle>;
  decodeVinValues: typeof decodeVinValues;
};

type RunAuctionCheckOptions = {
  env: AppEnv;
  sources: AuctionCheckSource[];
  checkedAt?: string;
  deps?: AuctionCheckDeps;
};

const defaultDeps: AuctionCheckDeps = {
  getStats,
  getAuctionFilters,
  isSeen,
  markSeen,
  saveLastCheck,
  upsertRecentVehicle,
  sendTelegramAlert,
  enrichVehicle: enrichVehicleImage,
  decodeVinValues,
};

export async function runAuctionCheck({
  env,
  sources,
  checkedAt = new Date().toISOString(),
  deps = defaultDeps,
}: RunAuctionCheckOptions): Promise<CronCheckSummary> {
  const sourceSummaries: SourceCheckSummary[] = [];
  let totalFound = 0;
  let newFound = 0;

  const [stats, filters] = await Promise.all([
    deps.getStats(),
    deps.getAuctionFilters(),
  ]);
  const isFirstRun = stats.seenCount === 0;

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
      const matches = await filterMatchesWithOptionalVinDecode(
        vehicles,
        env,
        deps,
      );
      const enrichedMatches = (
        await mapWithConcurrency(matches, 8, deps.enrichVehicle)
      ).filter((vehicle) => matchesAuctionFilters(vehicle, filters));
      const unseen: AuctionVehicle[] = [];

      for (const vehicle of enrichedMatches) {
        if (!(await deps.isSeen(vehicle.id))) {
          unseen.push(vehicle);
        } else {
          await deps.upsertRecentVehicle(vehicle);
        }
      }

      const shouldNotify = !isFirstRun || env.FIRST_RUN_NOTIFY;
      for (const vehicle of unseen) {
        if (shouldNotify) {
          await deps.sendTelegramAlert(vehicle, env);
          newFound += 1;
        }

        await deps.markSeen(vehicle);
      }

      totalFound += enrichedMatches.length;
      sourceSummaries.push({
        source: sourceConfig.source,
        enabled: true,
        ok: true,
        found: vehicles.length,
        matched: enrichedMatches.length,
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

  await deps.saveLastCheck(summary);
  return summary;
}

async function filterMatchesWithOptionalVinDecode(
  vehicles: AuctionVehicle[],
  env: AppEnv,
  deps: Pick<AuctionCheckDeps, "decodeVinValues">,
): Promise<AuctionVehicle[]> {
  const matches: AuctionVehicle[] = [];

  for (const vehicle of vehicles) {
    let decodedTrim: string | undefined;

    if (vehicle.vin && !vehicleClearlyMentionsCalligraphy(vehicle)) {
      try {
        const decoded = await deps.decodeVinValues(vehicle.vin);
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

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}
