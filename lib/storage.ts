import { Redis } from "@upstash/redis";
import { loadEnv, type AppEnv } from "./env";
import {
  DEFAULT_AUCTION_FILTERS,
  normalizeAuctionFilters,
} from "./filter-settings";
import type {
  AuctionFilters,
  AuctionVehicle,
  CronCheckSummary,
  DashboardStats,
} from "./types";

export const SEEN_KEY = "auction-alerts:seen";
export const RECENT_KEY = "auction-alerts:recent";
export const LAST_CHECK_KEY = "auction-alerts:last-check";
export const FILTERS_KEY = "auction-alerts:filters";
export const WATCHED_KEY = "auction-alerts:watched";
export const RECENT_HISTORY_LIMIT = 500;

let redisSingleton: Redis | null = null;

export function getRedis(env: AppEnv = loadEnv()): Redis {
  if (!redisSingleton) {
    redisSingleton = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redisSingleton;
}

export async function isSeen(id: string, redis = getRedis()): Promise<boolean> {
  const result = await redis.sismember(SEEN_KEY, id);
  return result === 1;
}

export async function markSeen(
  vehicle: AuctionVehicle,
  redis = getRedis(),
): Promise<void> {
  await redis.sadd(SEEN_KEY, vehicle.id);
  await upsertRecentVehicle(vehicle, redis);
}

export async function upsertRecentVehicle(
  vehicle: AuctionVehicle,
  redis = getRedis(),
): Promise<void> {
  const current = await getRecent(RECENT_HISTORY_LIMIT, redis);
  const next = [
    vehicle,
    ...current.filter((item) => item.id !== vehicle.id),
  ].slice(0, RECENT_HISTORY_LIMIT);

  await redis.del(RECENT_KEY);

  if (next.length > 0) {
    await redis.rpush(
      RECENT_KEY,
      ...next.map((item) => JSON.stringify(item)),
    );
  }
}

export async function getRecent(
  limit = RECENT_HISTORY_LIMIT,
  redis = getRedis(),
): Promise<AuctionVehicle[]> {
  const items = await redis.lrange<string | AuctionVehicle>(RECENT_KEY, 0, limit - 1);

  return items
    .map((item) => {
      if (typeof item === "string") {
        return JSON.parse(item) as AuctionVehicle;
      }

      return item;
    })
    .filter((item): item is AuctionVehicle => Boolean(item?.id));
}

export async function getStats(redis = getRedis()): Promise<DashboardStats> {
  const [seenCount, lastCheck] = await Promise.all([
    redis.scard(SEEN_KEY),
    redis.get<CronCheckSummary>(LAST_CHECK_KEY),
  ]);

  return {
    seenCount: typeof seenCount === "number" ? seenCount : 0,
    lastCheck: lastCheck ?? null,
  };
}

export async function saveLastCheck(
  summary: CronCheckSummary,
  redis = getRedis(),
): Promise<void> {
  await redis.set(LAST_CHECK_KEY, summary);
}

export async function getAuctionFilters(
  redis = getRedis(),
): Promise<AuctionFilters> {
  const filters = await redis.get<AuctionFilters>(FILTERS_KEY);
  return filters ? normalizeAuctionFilters(filters) : DEFAULT_AUCTION_FILTERS;
}

export async function saveAuctionFilters(
  filters: AuctionFilters,
  redis = getRedis(),
): Promise<AuctionFilters> {
  const normalized = normalizeAuctionFilters(filters);
  await redis.set(FILTERS_KEY, normalized);
  return normalized;
}

export async function getWatchedIds(redis = getRedis()): Promise<Set<string>> {
  const ids = (await redis.smembers(WATCHED_KEY)) as unknown[];
  return new Set(
    ids.filter((id): id is string => typeof id === "string" && id.length > 0),
  );
}

export async function setWatchedVehicle(
  id: string,
  watched: boolean,
  redis = getRedis(),
): Promise<void> {
  if (watched) {
    await redis.sadd(WATCHED_KEY, id);
    return;
  }

  await redis.srem(WATCHED_KEY, id);
}
