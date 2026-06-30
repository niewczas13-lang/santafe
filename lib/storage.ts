import { Redis } from "@upstash/redis";
import { loadEnv, type AppEnv } from "./env";
import type { AuctionVehicle, CronCheckSummary, DashboardStats } from "./types";

export const SEEN_KEY = "auction-alerts:seen";
export const RECENT_KEY = "auction-alerts:recent";
export const LAST_CHECK_KEY = "auction-alerts:last-check";

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
  await redis.lpush(RECENT_KEY, JSON.stringify(vehicle));
  await redis.ltrim(RECENT_KEY, 0, 99);
}

export async function getRecent(
  limit = 20,
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
