import { describe, expect, it } from "vitest";
import { matchesSantaFeCalligraphy } from "../lib/filter";
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
