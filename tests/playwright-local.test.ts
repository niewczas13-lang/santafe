import { describe, expect, it } from "vitest";
import { mergeVehicleDetails } from "../lib/providers/playwright-local";
import type { AuctionVehicle } from "../lib/types";

describe("mergeVehicleDetails", () => {
  it("adds detail-page fields without dropping existing listing fields", () => {
    const vehicle: AuctionVehicle = {
      id: "iaai:stock:45433626",
      source: "iaai",
      stockNumber: "45433626",
      title: "2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
      url: "https://www.iaai.com/VehicleDetail/45433626~US",
      imageUrl:
        "https://vis.iaai.com/resizer?imageKeys=45433626~SID~I1&width=640&height=480",
    };

    expect(
      mergeVehicleDetails(vehicle, {
        engine: "1.6L I-4 DI, DOHC, VVT, TURBO, 178HP",
        exteriorColor: "White",
        interiorColor: "Gray",
        saleDate: "2026-07-07T13:30:00.000Z",
      }),
    ).toMatchObject({
      id: "iaai:stock:45433626",
      stockNumber: "45433626",
      title: "2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
      imageUrl:
        "https://vis.iaai.com/resizer?imageKeys=45433626~SID~I1&width=640&height=480",
      engine: "1.6L I-4 DI, DOHC, VVT, TURBO, 178HP",
      exteriorColor: "White",
      interiorColor: "Gray",
      saleDate: "2026-07-07T13:30:00.000Z",
    });
  });
});
