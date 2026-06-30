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
        excludedInteriorColor: "",
        maxEngineLiters: 2,
        runStatuses: ["run_and_drive"],
        requireCalligraphy: true,
      }),
    ).toBe(true);
  });

  it("rejects vehicles that do not match selected practical filters", () => {
    expect(
      matchesAuctionFilters(calligraphyVehicle, {
        exteriorColor: "white",
        excludedInteriorColor: "",
        engine: "",
        maxEngineLiters: undefined,
        runStatuses: [],
        requireCalligraphy: true,
      }),
    ).toBe(false);

    expect(
      matchesAuctionFilters(calligraphyVehicle, {
        runStatuses: ["starts"],
        excludedInteriorColor: "",
        engine: "",
        maxEngineLiters: undefined,
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
          excludedInteriorColor: "",
          engine: "",
          maxEngineLiters: undefined,
          requireCalligraphy: true,
        },
      ),
    ).toBe(true);
  });

  it("rejects black interiors by default-style practical filter", () => {
    expect(
      matchesAuctionFilters(calligraphyVehicle, {
        excludedInteriorColor: "black",
        engine: "hybrid",
        maxEngineLiters: 2,
        runStatuses: [],
        requireCalligraphy: true,
      }),
    ).toBe(false);
  });

  it("rejects 2.5T non-hybrid engines and keeps 1.6 hybrid listings", () => {
    expect(
      matchesAuctionFilters(
        {
          ...calligraphyVehicle,
          title: "2024 HYUNDAI SANTA FE CALLIGRAPHY",
          engine: "2.5L Turbo",
          interiorColor: "Gray",
        },
        {
          engine: "hybrid",
          maxEngineLiters: 2,
          excludedInteriorColor: "black",
          runStatuses: [],
          requireCalligraphy: true,
        },
      ),
    ).toBe(false);

    expect(
      matchesAuctionFilters(
        {
          ...calligraphyVehicle,
          title: "2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
          engine: "1.6L Hybrid",
          interiorColor: "Gray",
        },
        {
          engine: "hybrid",
          maxEngineLiters: 2,
          excludedInteriorColor: "black",
          runStatuses: [],
          requireCalligraphy: true,
        },
      ),
    ).toBe(true);
  });

  it("filters vehicles with auction dates outside the configured range", () => {
    const filters = {
      exteriorColor: "",
      interiorColor: "",
      excludedInteriorColor: "",
      engine: "",
      maxEngineLiters: undefined,
      requireCalligraphy: true,
      runStatuses: [],
      auctionDateFrom: "2026-07-01",
      auctionDateTo: "2026-07-31",
    };

    expect(
      matchesAuctionFilters(
        { ...calligraphyVehicle, saleDate: "2026-07-15T12:00:00Z" },
        filters,
      ),
    ).toBe(true);
    expect(
      matchesAuctionFilters(
        { ...calligraphyVehicle, saleDate: "2026-08-01T12:00:00Z" },
        filters,
      ),
    ).toBe(false);
  });

  it("keeps vehicles without auction dates so they can be reviewed separately", () => {
    expect(
      matchesAuctionFilters(
        { ...calligraphyVehicle, saleDate: undefined },
        {
          exteriorColor: "",
          interiorColor: "",
          excludedInteriorColor: "",
          engine: "",
          maxEngineLiters: undefined,
          requireCalligraphy: true,
          runStatuses: [],
          auctionDateFrom: "2026-07-01",
          auctionDateTo: "2026-07-31",
        },
      ),
    ).toBe(true);
  });
});
