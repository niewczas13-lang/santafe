import type { AuctionVehicle } from "./types";

export function normalizeDateFilter(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return "";
  }

  return Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`)) ? "" : trimmed;
}

export function parseAuctionDate(value: string | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

export function getAuctionTime(vehicle: AuctionVehicle): number | null {
  return parseAuctionDate(vehicle.saleDate)?.getTime() ?? null;
}

export function isAuctionDateInRange(
  vehicle: AuctionVehicle,
  from: string | undefined,
  to: string | undefined,
): boolean {
  const auctionTime = getAuctionTime(vehicle);
  if (auctionTime == null) {
    return true;
  }

  const fromDate = normalizeDateFilter(from);
  if (fromDate) {
    const fromTime = Date.parse(`${fromDate}T00:00:00Z`);
    if (auctionTime < fromTime) {
      return false;
    }
  }

  const toDate = normalizeDateFilter(to);
  if (toDate) {
    const toTime = Date.parse(`${toDate}T23:59:59.999Z`);
    if (auctionTime > toTime) {
      return false;
    }
  }

  return true;
}
