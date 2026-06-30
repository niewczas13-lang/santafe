import type { AuctionFilters, VehicleRunStatus } from "./types";

export const ALL_RUN_STATUSES: VehicleRunStatus[] = [
  "run_and_drive",
  "starts",
  "stationary",
  "unknown",
];

export const DEFAULT_AUCTION_FILTERS: AuctionFilters = {
  exteriorColor: "",
  interiorColor: "",
  engine: "",
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
    engine: cleanString(input.engine),
    requireCalligraphy:
      typeof input.requireCalligraphy === "boolean"
        ? input.requireCalligraphy
        : DEFAULT_AUCTION_FILTERS.requireCalligraphy,
    runStatuses:
      runStatuses.length > 0 ? runStatuses : DEFAULT_AUCTION_FILTERS.runStatuses,
  };
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
