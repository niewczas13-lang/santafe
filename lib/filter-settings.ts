import type { AuctionFilters, VehicleRunStatus } from "./types";
import { normalizeDateFilter } from "./auction-date";

export const ALL_RUN_STATUSES: VehicleRunStatus[] = [
  "run_and_drive",
  "starts",
  "stationary",
  "unknown",
];

export const DEFAULT_AUCTION_FILTERS: AuctionFilters = {
  exteriorColor: "",
  interiorColor: "",
  excludedInteriorColor: "black",
  engine: "hybrid",
  auctionDateFrom: "",
  auctionDateTo: "",
  maxEngineLiters: 2,
  requireCalligraphy: true,
  runStatuses: ALL_RUN_STATUSES,
};

export function normalizeAuctionFilters(input: unknown): AuctionFilters {
  if (!isRecord(input)) {
    return DEFAULT_AUCTION_FILTERS;
  }

  const runStatuses = Array.isArray(input.runStatuses)
    ? input.runStatuses.filter(isRunStatus)
    : DEFAULT_AUCTION_FILTERS.runStatuses;

  return {
    exteriorColor: cleanString(input.exteriorColor),
    interiorColor: cleanString(input.interiorColor),
    excludedInteriorColor:
      cleanString(input.excludedInteriorColor) ||
      DEFAULT_AUCTION_FILTERS.excludedInteriorColor,
    engine: cleanString(input.engine),
    auctionDateFrom: normalizeDateFilter(input.auctionDateFrom),
    auctionDateTo: normalizeDateFilter(input.auctionDateTo),
    maxEngineLiters: cleanPositiveNumber(input.maxEngineLiters),
    requireCalligraphy: true,
    runStatuses:
      runStatuses.length > 0 ? runStatuses : DEFAULT_AUCTION_FILTERS.runStatuses,
  };
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanPositiveNumber(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : undefined;

  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_AUCTION_FILTERS.maxEngineLiters;
  }

  return parsed;
}

function isRunStatus(value: unknown): value is VehicleRunStatus {
  return (
    value === "run_and_drive" ||
    value === "starts" ||
    value === "stationary" ||
    value === "unknown"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
