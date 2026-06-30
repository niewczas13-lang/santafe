import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUCTION_FILTERS,
  normalizeAuctionFilters,
} from "../lib/filter-settings";

describe("normalizeAuctionFilters", () => {
  it("returns practical defaults for empty input", () => {
    expect(normalizeAuctionFilters(null)).toEqual(DEFAULT_AUCTION_FILTERS);
  });

  it("trims text filters and keeps supported run statuses", () => {
    expect(
      normalizeAuctionFilters({
        exteriorColor: " gray ",
        interiorColor: " black ",
        engine: " hybrid ",
        requireCalligraphy: false,
        runStatuses: ["starts", "unknown", "bad-value"],
      }),
    ).toEqual({
      exteriorColor: "gray",
      interiorColor: "black",
      engine: "hybrid",
      requireCalligraphy: false,
      runStatuses: ["starts", "unknown"],
    });
  });
});
