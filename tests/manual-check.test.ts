import { describe, expect, it } from "vitest";
import {
  MANUAL_CHECK_QUEUE_KEY,
  MANUAL_CHECK_STATUS_KEY,
  claimManualCheckRequest,
  enqueueManualCheckRequest,
  markManualCheckRequestFinished,
  markManualCheckRequestRunning,
} from "../lib/manual-check";

describe("manual check queue", () => {
  it("queues, claims and stores manual check status", async () => {
    const redis = new FakeRedis();

    const request = await enqueueManualCheckRequest(
      { source: "iaai" },
      redis,
      "2026-06-30T20:00:00.000Z",
    );

    expect(request).toMatchObject({
      source: "iaai",
      status: "queued",
      requestedAt: "2026-06-30T20:00:00.000Z",
    });
    expect(await redis.get(MANUAL_CHECK_STATUS_KEY)).toEqual(request);

    const claimed = await claimManualCheckRequest(redis);

    expect(claimed).toEqual(request);
    expect(await claimManualCheckRequest(redis)).toBeNull();

    await markManualCheckRequestRunning(request, redis, "2026-06-30T20:00:05.000Z");
    expect(await redis.get(MANUAL_CHECK_STATUS_KEY)).toMatchObject({
      id: request.id,
      status: "running",
      startedAt: "2026-06-30T20:00:05.000Z",
    });

    await markManualCheckRequestFinished(
      request,
      {
        ok: true,
        checkedAt: "2026-06-30T20:01:00.000Z",
        totalFound: 2,
        newFound: 1,
        sources: [],
      },
      redis,
      "2026-06-30T20:01:01.000Z",
    );

    expect(await redis.get(MANUAL_CHECK_STATUS_KEY)).toMatchObject({
      id: request.id,
      status: "finished",
      finishedAt: "2026-06-30T20:01:01.000Z",
      summary: {
        ok: true,
        totalFound: 2,
        newFound: 1,
      },
    });
    expect(await redis.lpop(MANUAL_CHECK_QUEUE_KEY)).toBeNull();
  });

  it("claims Upstash-decoded queue items", async () => {
    const redis = new FakeRedis();
    redis.pushDecodedListItem(MANUAL_CHECK_QUEUE_KEY, {
      id: "manual-1",
      source: "iaai",
      status: "queued",
      requestedAt: "2026-06-30T20:00:00.000Z",
    });

    await expect(claimManualCheckRequest(redis)).resolves.toEqual({
      id: "manual-1",
      source: "iaai",
      status: "queued",
      requestedAt: "2026-06-30T20:00:00.000Z",
    });
  });
});

class FakeRedis {
  private values = new Map<string, unknown>();
  private lists = new Map<string, unknown[]>();

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async rpush(key: string, value: string): Promise<void> {
    this.lists.set(key, [...(this.lists.get(key) ?? []), value]);
  }

  pushDecodedListItem(key: string, value: unknown): void {
    this.lists.set(key, [...(this.lists.get(key) ?? []), value]);
  }

  async lpop(key: string): Promise<string | null> {
    const list = this.lists.get(key) ?? [];
    const item = (list.shift() as string | undefined) ?? null;
    this.lists.set(key, list);
    return item;
  }
}
