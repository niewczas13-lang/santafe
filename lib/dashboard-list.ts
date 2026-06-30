import { getAuctionTime } from "./auction-date";
import { matchesAuctionFilters } from "./filter";
import type { AuctionFilters, AuctionVehicle } from "./types";

export type DashboardSections = {
  watched: AuctionVehicle[];
  scheduled: AuctionVehicle[];
  unscheduled: AuctionVehicle[];
};

export function buildDashboardSections(
  vehicles: AuctionVehicle[],
  watchedIds: Set<string>,
): DashboardSections {
  const watched: AuctionVehicle[] = [];
  const scheduled: AuctionVehicle[] = [];
  const unscheduled: AuctionVehicle[] = [];

  for (const vehicle of vehicles) {
    if (watchedIds.has(vehicle.id)) {
      watched.push(vehicle);
      continue;
    }

    if (getAuctionTime(vehicle) == null) {
      unscheduled.push(vehicle);
    } else {
      scheduled.push(vehicle);
    }
  }

  scheduled.sort(compareByAuctionDate);
  watched.sort(compareByAuctionDate);

  return { watched, scheduled, unscheduled };
}

export function selectDashboardVehicles(
  vehicles: AuctionVehicle[],
  watchedIds: Set<string>,
  filters: AuctionFilters,
): AuctionVehicle[] {
  return vehicles.filter(
    (vehicle) => watchedIds.has(vehicle.id) || matchesAuctionFilters(vehicle, filters),
  );
}

function compareByAuctionDate(left: AuctionVehicle, right: AuctionVehicle): number {
  const leftTime = getAuctionTime(left) ?? Number.MAX_SAFE_INTEGER;
  const rightTime = getAuctionTime(right) ?? Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime;
}
