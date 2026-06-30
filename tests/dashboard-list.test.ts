import { describe, expect, it } from "vitest";
import {
  buildDashboardSections,
  selectDashboardVehicles,
} from "../lib/dashboard-list";
import type { AuctionVehicle } from "../lib/types";

describe("buildDashboardSections", () => {
  it("separates watched, scheduled and unscheduled vehicles", () => {
    const vehicles: AuctionVehicle[] = [
      makeVehicle("later", "2026-08-10T12:00:00Z"),
      makeVehicle("no-date"),
      makeVehicle("watched", "2026-08-03T12:00:00Z"),
      makeVehicle("soon", "2026-08-01T12:00:00Z"),
    ];

    const sections = buildDashboardSections(vehicles, new Set(["iaai:stock:watched"]));

    expect(sections.watched.map((vehicle) => vehicle.id)).toEqual([
      "iaai:stock:watched",
    ]);
    expect(sections.scheduled.map((vehicle) => vehicle.id)).toEqual([
      "iaai:stock:soon",
      "iaai:stock:later",
    ]);
    expect(sections.unscheduled.map((vehicle) => vehicle.id)).toEqual([
      "iaai:stock:no-date",
    ]);
  });

  it("applies dashboard filters while keeping watched vehicles visible", () => {
    const vehicles: AuctionVehicle[] = [
      makeVehicle("watched-outside-range", "2026-09-01T12:00:00Z"),
      makeVehicle("outside-range", "2026-09-02T12:00:00Z"),
      makeVehicle("inside-range", "2026-08-02T12:00:00Z"),
    ];

    const selected = selectDashboardVehicles(
      vehicles,
      new Set(["iaai:stock:watched-outside-range"]),
      {
        exteriorColor: "",
        interiorColor: "",
        excludedInteriorColor: "",
        engine: "",
        maxEngineLiters: undefined,
        requireCalligraphy: true,
        runStatuses: [],
        auctionDateFrom: "2026-08-01",
        auctionDateTo: "2026-08-31",
      },
    );

    expect(selected.map((vehicle) => vehicle.id)).toEqual([
      "iaai:stock:watched-outside-range",
      "iaai:stock:inside-range",
    ]);
  });
});

function makeVehicle(id: string, saleDate?: string): AuctionVehicle {
  return {
    id: `iaai:stock:${id}`,
    source: "iaai",
    title: "2026 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
    url: `https://www.iaai.com/VehicleDetail/${id}~US`,
    saleDate,
  };
}
