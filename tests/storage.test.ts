import { describe, expect, it } from "vitest";
import {
  getRecent,
  getWatchedIds,
  setWatchedVehicle,
  upsertRecentVehicle,
} from "../lib/storage";
import type { AuctionVehicle } from "../lib/types";

class MemoryRedis {
  items: Array<string | AuctionVehicle> = [];
  watched = new Set<string>();

  async lrange(_key: string, start: number, end: number) {
    return this.items.slice(start, end + 1);
  }

  async del() {
    this.items = [];
  }

  async rpush(_key: string, ...items: string[]) {
    this.items.push(...items);
  }

  async smembers() {
    return [...this.watched];
  }

  async sadd(_key: string, id: string) {
    this.watched.add(id);
  }

  async srem(_key: string, id: string) {
    this.watched.delete(id);
  }
}

describe("recent auction storage", () => {
  it("keeps enough recent vehicles to show a full 200 item source scan", async () => {
    const redis = new MemoryRedis();

    for (let index = 0; index < 220; index += 1) {
      await upsertRecentVehicle(makeVehicle(index), redis as never);
    }

    const recent = await getRecent(220, redis as never);

    expect(recent).toHaveLength(220);
    expect(recent[0]?.id).toBe("iaai:stock:219");
    expect(recent.at(-1)?.id).toBe("iaai:stock:0");
  });

  it("stores watched vehicle IDs separately from recent listings", async () => {
    const redis = new MemoryRedis();

    await setWatchedVehicle("iaai:stock:44208863", true, redis as never);
    expect(await getWatchedIds(redis as never)).toEqual(
      new Set(["iaai:stock:44208863"]),
    );

    await setWatchedVehicle("iaai:stock:44208863", false, redis as never);
    expect(await getWatchedIds(redis as never)).toEqual(new Set());
  });
});

function makeVehicle(index: number): AuctionVehicle {
  return {
    id: `iaai:stock:${index}`,
    source: "iaai",
    stockNumber: String(index),
    title: `2024 HYUNDAI SANTA FE HYBRID CALLIGRAPHY ${index}`,
    url: `https://www.iaai.com/VehicleDetail/${index}~US`,
  };
}
