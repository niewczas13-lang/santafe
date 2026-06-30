import { describe, expect, it } from "vitest";
import { matchesAuctionFilters, matchesSantaFeCalligraphy } from "../lib/filter";
import type { AuctionVehicle } from "../lib/types";

const baseVehicle: AuctionVehicle = {
  id: "copart:sample",
  source: "copart",
  title: "",
  url: "https://example.com/sample",
};

describe("matchesSantaFeCalligraphy", () => {
  it.each([
    ["2024 HYUNDAI SANTA FE CALLIGRAPHY", true],
    ["2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY", true],
    ["2024 HYUNDAI SANTA FE LIMITED", false],
    ["2024 HYUNDAI SANTA FE XRT", false],
    ["2023 HYUNDAI SANTA FE CALLIGRAPHY", false],
  ])("matches %s as %s", (title, expected) => {
    expect(
      matchesSantaFeCalligraphy({ ...baseVehicle, title }, { minYear: 2024 }),
    ).toBe(expected);
  });

  it("uses raw and decoded trim fields when title is incomplete", () => {
    expect(
      matchesSantaFeCalligraphy(
        {
          ...baseVehicle,
          title: "2024 Hyundai Santa Fe",
          raw: { trim: "Hybrid Calligraphy AWD" },
        },
        { minYear: 2024 },
      ),
    ).toBe(true);
  });
});

describe("matchesAuctionFilters", () => {
  const calligraphyVehicle: AuctionVehicle = {
    ...baseVehicle,
    title: "2024 HYUNDAI SANTA FE CALLIGRAPHY",
    year: 2024,
    make: "HYUNDAI",
    model: "SANTA FE",
    trim: "CALLIGRAPHY",
    exteriorColor: "Hampton Gray",
    interiorColor: "Black",
    engine: "1.6L Hybrid",
    runStatus: "run_and_drive",
  };

  it("matches preferred color, interior, engine and run status", () => {
    expect(
      matchesAuctionFilters(calligraphyVehicle, {
        exteriorColor: "gray",
        interiorColor: "black",
        engine: "hybrid",
        runStatuses: ["run_and_drive"],
        requireCalligraphy: true,
      }),
    ).toBe(true);
  });

  it("rejects vehicles that do not match selected practical filters", () => {
    expect(
      matchesAuctionFilters(calligraphyVehicle, {
        exteriorColor: "white",
        requireCalligraphy: true,
      }),
    ).toBe(false);

    expect(
      matchesAuctionFilters(calligraphyVehicle, {
        runStatuses: ["starts"],
        requireCalligraphy: true,
      }),
    ).toBe(false);
  });

  it("can keep listings with no run status when no-info is selected", () => {
    expect(
      matchesAuctionFilters(
        { ...calligraphyVehicle, runStatus: "unknown" },
        {
          runStatuses: ["unknown"],
          requireCalligraphy: true,
        },
      ),
    ).toBe(true);
  });
});
