import { randomUUID } from "crypto";
import { getRedis } from "./storage";
import type { CronCheckSummary } from "./types";

export const MANUAL_CHECK_QUEUE_KEY = "auction-alerts:manual-check:queue";
export const MANUAL_CHECK_STATUS_KEY = "auction-alerts:manual-check:status";

export type ManualCheckSource = "all" | "copart" | "iaai";

export type ManualCheckRequest = {
  id: string;
  source: ManualCheckSource;
  status: "queued";
  requestedAt: string;
};

export type ManualCheckStatus =
  | ManualCheckRequest
  | (Omit<ManualCheckRequest, "status"> & {
      status: "running";
      startedAt: string;
    })
  | (Omit<ManualCheckRequest, "status"> & {
      status: "finished";
      finishedAt: string;
      summary: CronCheckSummary;
    })
  | (Omit<ManualCheckRequest, "status"> & {
      status: "failed";
      finishedAt: string;
      error: string;
    });

type ManualCheckRedis = {
  set: (key: string, value: unknown) => Promise<unknown>;
  get: <T>(key: string) => Promise<T | null>;
  rpush: (key: string, value: string) => Promise<unknown>;
  lpop: (key: string) => Promise<unknown | null>;
};

export async function enqueueManualCheckRequest(
  input: { source?: ManualCheckSource } = {},
  redis: ManualCheckRedis = getRedis(),
  requestedAt = new Date().toISOString(),
): Promise<ManualCheckRequest> {
  const request: ManualCheckRequest = {
    id: randomUUID(),
    source: input.source ?? "all",
    status: "queued",
    requestedAt,
  };

  await redis.rpush(MANUAL_CHECK_QUEUE_KEY, JSON.stringify(request));
  await redis.set(MANUAL_CHECK_STATUS_KEY, request);
  return request;
}

export async function claimManualCheckRequest(
  redis: ManualCheckRedis = getRedis(),
): Promise<ManualCheckRequest | null> {
  const item = await redis.lpop(MANUAL_CHECK_QUEUE_KEY);
  if (!item) {
    return null;
  }

  return parseManualCheckRequest(item);
}

export async function getManualCheckStatus(
  redis: ManualCheckRedis = getRedis(),
): Promise<ManualCheckStatus | null> {
  return redis.get<ManualCheckStatus>(MANUAL_CHECK_STATUS_KEY);
}

export async function markManualCheckRequestRunning(
  request: ManualCheckRequest,
  redis: ManualCheckRedis = getRedis(),
  startedAt = new Date().toISOString(),
): Promise<void> {
  await redis.set(MANUAL_CHECK_STATUS_KEY, {
    ...request,
    status: "running",
    startedAt,
  } satisfies ManualCheckStatus);
}

export async function markManualCheckRequestFinished(
  request: ManualCheckRequest,
  summary: CronCheckSummary,
  redis: ManualCheckRedis = getRedis(),
  finishedAt = new Date().toISOString(),
): Promise<void> {
  await redis.set(MANUAL_CHECK_STATUS_KEY, {
    id: request.id,
    source: request.source,
    requestedAt: request.requestedAt,
    status: "finished",
    finishedAt,
    summary,
  } satisfies ManualCheckStatus);
}

export async function markManualCheckRequestFailed(
  request: ManualCheckRequest,
  error: unknown,
  redis: ManualCheckRedis = getRedis(),
  finishedAt = new Date().toISOString(),
): Promise<void> {
  await redis.set(MANUAL_CHECK_STATUS_KEY, {
    id: request.id,
    source: request.source,
    requestedAt: request.requestedAt,
    status: "failed",
    finishedAt,
    error: error instanceof Error ? error.message : String(error),
  } satisfies ManualCheckStatus);
}

function parseManualCheckRequest(item: unknown): ManualCheckRequest {
  const value =
    typeof item === "string" ? (JSON.parse(item) as unknown) : item;

  if (!isManualCheckRequest(value)) {
    throw new Error("Invalid manual check request in queue");
  }

  return value;
}

function isManualCheckRequest(value: unknown): value is ManualCheckRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const request = value as Partial<ManualCheckRequest>;
  return (
    typeof request.id === "string" &&
    typeof request.requestedAt === "string" &&
    request.status === "queued" &&
    (request.source === "all" ||
      request.source === "copart" ||
      request.source === "iaai")
  );
}
