import { describe, expect, it } from "vitest";
import {
  getLocalDetailPolicy,
  mergeVehicleDetails,
  selectDetailVehicles,
} from "../lib/providers/playwright-local";
import type { AppEnv } from "../lib/env";
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

  it("opens Copart detail pages one at a time with a configurable limit", () => {
    expect(
      getLocalDetailPolicy("copart", {
        COPART_DETAIL_PAGE_LIMIT: 7,
        COPART_DETAIL_DELAY_MS: 2500,
      } as AppEnv),
    ).toEqual({
      concurrency: 1,
      delayMs: 2500,
      limit: 7,
    });
  });

  it("only enriches likely Copart Calligraphy candidates before opening detail pages", () => {
    const vehicles: AuctionVehicle[] = [
      {
        id: "copart:lot:1",
        source: "copart",
        lotNumber: "1",
        title: "2025 HYUNDAI SANTA FE CALLIGRAPHY",
        url: "https://www.copart.com/lot/1",
      },
      {
        id: "copart:lot:2",
        source: "copart",
        lotNumber: "2",
        title: "2024 HYUNDAI SANTA FE LIMITED",
        url: "https://www.copart.com/lot/2",
      },
      {
        id: "copart:lot:3",
        source: "copart",
        lotNumber: "3",
        title: "2026 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
        url: "https://www.copart.com/lot/3",
      },
    ];

    expect(
      selectDetailVehicles("copart", vehicles, {
        MIN_YEAR: 2024,
        COPART_DETAIL_PAGE_LIMIT: 1,
      } as AppEnv),
    ).toEqual([vehicles[0]]);
  });

  it("keeps all IAAI vehicles eligible for detail enrichment", () => {
    const vehicles: AuctionVehicle[] = [
      {
        id: "iaai:stock:1",
        source: "iaai",
        stockNumber: "1",
        title: "2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
        url: "https://www.iaai.com/VehicleDetail/1~US",
      },
      {
        id: "iaai:stock:2",
        source: "iaai",
        stockNumber: "2",
        title: "2024 HYUNDAI SANTA FE CALLIGRAPHY",
        url: "https://www.iaai.com/VehicleDetail/2~US",
      },
    ];

    expect(selectDetailVehicles("iaai", vehicles, {} as AppEnv)).toEqual(
      vehicles,
    );
  });
});
