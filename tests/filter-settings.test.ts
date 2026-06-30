import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUCTION_FILTERS,
  normalizeAuctionFilters,
} from "../lib/filter-settings";

describe("normalizeAuctionFilters", () => {
  it("returns practical defaults for empty input", () => {
    expect(normalizeAuctionFilters(null)).toEqual({
      ...DEFAULT_AUCTION_FILTERS,
      excludedInteriorColor: "black",
      engine: "hybrid",
      maxEngineLiters: 2,
      requireCalligraphy: true,
    });
  });

  it("trims text filters and keeps supported run statuses", () => {
    expect(
      normalizeAuctionFilters({
        exteriorColor: " gray ",
        interiorColor: " black ",
        excludedInteriorColor: " beige ",
        engine: " hybrid ",
        maxEngineLiters: "1.8",
        requireCalligraphy: false,
        runStatuses: ["starts", "unknown", "bad-value"],
      }),
    ).toEqual({
      exteriorColor: "gray",
      interiorColor: "black",
      excludedInteriorColor: "beige",
      engine: "hybrid",
      maxEngineLiters: 1.8,
      requireCalligraphy: true,
      runStatuses: ["starts", "unknown"],
    });
  });
});
