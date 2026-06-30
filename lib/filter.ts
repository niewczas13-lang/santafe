import type { AuctionFilters, AuctionVehicle } from "./types";

type MatchOptions = {
  minYear: number;
  decodedTrim?: string;
};

const NON_CALLIGRAPHY_TRIMS = [" se ", " sel ", " xrt ", " limited "];

export function normalizeAuctionText(value: unknown): string {
  if (value == null) {
    return "";
  }

  return String(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function vehicleText(
  vehicle: AuctionVehicle,
  decodedTrim?: string,
): string {
  const rawText =
    vehicle.raw == null ? "" : JSON.stringify(vehicle.raw, safeJsonReplacer);

  return normalizeAuctionText(
    [
      vehicle.title,
      vehicle.year,
      vehicle.make,
      vehicle.model,
      vehicle.trim,
      vehicle.exteriorColor,
      vehicle.interiorColor,
      vehicle.engine,
      vehicle.runStatus,
      decodedTrim,
      rawText,
    ].join(" "),
  );
}

export function matchesAuctionFilters(
  vehicle: AuctionVehicle,
  filters: AuctionFilters,
): boolean {
  if (filters.requireCalligraphy && !vehicleText(vehicle).includes("calligraphy")) {
    return false;
  }

  if (!matchesTextFilter(vehicle.exteriorColor, filters.exteriorColor)) {
    return false;
  }

  if (!matchesTextFilter(vehicle.interiorColor, filters.interiorColor)) {
    return false;
  }

  if (!matchesTextFilter(vehicle.engine, filters.engine)) {
    return false;
  }

  if (
    filters.runStatuses.length > 0 &&
    !filters.runStatuses.includes(vehicle.runStatus ?? "unknown")
  ) {
    return false;
  }

  return true;
}

function matchesTextFilter(value: string | undefined, filter: string | undefined) {
  const normalizedFilter = normalizeAuctionText(filter);
  if (!normalizedFilter) {
    return true;
  }

  return normalizeAuctionText(value).includes(normalizedFilter);
}

export function extractVehicleYear(vehicle: AuctionVehicle): number | undefined {
  if (typeof vehicle.year === "number" && Number.isFinite(vehicle.year)) {
    return vehicle.year;
  }

  const match = vehicleText(vehicle).match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

export function vehicleClearlyMentionsCalligraphy(
  vehicle: AuctionVehicle,
): boolean {
  return vehicleText(vehicle).includes("calligraphy");
}

export function matchesSantaFeCalligraphy(
  vehicle: AuctionVehicle,
  options: MatchOptions,
): boolean {
  const text = ` ${vehicleText(vehicle, options.decodedTrim)} `;
  const year = extractVehicleYear(vehicle);

  if (!year || year < options.minYear) {
    return false;
  }

  const hasMake = text.includes(" hyundai ");
  const hasModel = text.includes(" santa fe ") || text.includes(" santafe ");
  const hasCalligraphy = text.includes(" calligraphy ");

  if (!hasMake || !hasModel || !hasCalligraphy) {
    return false;
  }

  const hasConflictingTrim = NON_CALLIGRAPHY_TRIMS.some((trim) =>
    text.includes(trim),
  );

  return !hasConflictingTrim || hasCalligraphy;
}

function safeJsonReplacer(_key: string, value: unknown) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}
