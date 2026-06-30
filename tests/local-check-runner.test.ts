import { describe, expect, it, vi } from "vitest";

const fakeBrowser = {
  closed: false,
  close: vi.fn(async () => {
    fakeBrowser.closed = true;
  }),
};

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => {
      fakeBrowser.closed = false;
      return fakeBrowser;
    }),
  },
}));

vi.mock("../lib/providers/playwright-local", () => ({
  fetchLocalCopartVehicles: vi.fn(async () => []),
  fetchLocalIaaiVehicles: vi.fn(async ({ browser }) => {
    if (browser.closed) {
      throw new Error("browser closed before provider finished");
    }

    return [];
  }),
}));

vi.mock("../lib/check-auctions", () => ({
  runAuctionCheck: vi.fn(async ({ sources }) => {
    await Promise.resolve();
    const iaai = sources.find((source) => source.source === "iaai");
    await iaai.fetchVehicles();

    return {
      ok: true,
      checkedAt: "2026-06-30T20:00:00.000Z",
      totalFound: 0,
      newFound: 0,
      sources: [],
    };
  }),
}));

describe("runLocalAuctionCheck", () => {
  it("keeps the browser open until the auction pipeline finishes", async () => {
    const { runLocalAuctionCheck } = await import("../lib/local-check-runner");

    await expect(
      runLocalAuctionCheck({
        env: {
          ENABLE_COPART: false,
          ENABLE_IAAI: true,
        } as never,
        source: "iaai",
        headless: true,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(fakeBrowser.close).toHaveBeenCalledOnce();
    expect(fakeBrowser.closed).toBe(true);
  });
});
