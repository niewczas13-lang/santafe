import * as cheerio from "cheerio";
import type { AuctionVehicle } from "./types";
import { isRecord, normalizeRunStatus } from "./providers/shared";

type ListingDetails = Partial<
  Pick<
    AuctionVehicle,
    | "engine"
    | "exteriorColor"
    | "imageUrl"
    | "interiorColor"
    | "runStatus"
    | "saleDate"
  >
>;

export function extractListingImageUrl(
  html: string,
  pageUrl: string,
): string | undefined {
  const $ = cheerio.load(html);
  const candidates = [
    $("meta[property='og:image']").attr("content"),
    $("meta[name='twitter:image']").attr("content"),
    $("meta[property='twitter:image']").attr("content"),
    $("img.vehicle-image").attr("src"),
    $("img[class*='vehicle']").attr("src"),
    $("img[src*='vis.iaai']").attr("src"),
    $("img[src*='copart']").attr("src"),
    $("img[src*='photo']").attr("src"),
    $("img[src*='image']").attr("src"),
  ];

  for (const candidate of candidates) {
    const resolved = resolveImageUrl(candidate, pageUrl);
    if (resolved) {
      return resolved;
    }
  }

  return extractListingDetailsFromHtml(html, pageUrl).imageUrl;
}

export function extractListingDetailsFromHtml(
  html: string,
  pageUrl: string,
): ListingDetails {
  return extractIaaiProductDetails(html, pageUrl);
}

export async function enrichVehicleImage(
  vehicle: AuctionVehicle,
): Promise<AuctionVehicle> {
  if (
    vehicle.imageUrl &&
    vehicle.engine &&
    vehicle.exteriorColor &&
    vehicle.interiorColor &&
    (vehicle.source !== "iaai" || vehicle.saleDate) &&
    vehicle.runStatus &&
    vehicle.runStatus !== "unknown"
  ) {
    return vehicle;
  }

  try {
    const response = await fetch(vehicle.url, {
      headers: {
        accept: "text/html",
        "user-agent":
          "Mozilla/5.0 auction-alerts/1.0 (+https://vercel.com/serverless)",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return vehicle;
    }

    const html = await response.text();
    const details = extractListingDetailsFromHtml(html, vehicle.url);
    const imageUrl =
      vehicle.imageUrl ?? details.imageUrl ?? extractListingImageUrl(html, vehicle.url);

    return mergeDefinedVehicleFields(vehicle, {
      ...details,
      imageUrl: vehicle.imageUrl ?? details.imageUrl ?? imageUrl,
    });
  } catch {
    return vehicle;
  }
}

function extractIaaiProductDetails(html: string, pageUrl: string): ListingDetails {
  const $ = cheerio.load(html);
  const script = $("#ProductDetailsVM").text().trim();

  if (!script) {
    return {};
  }

  try {
    const data = JSON.parse(script) as unknown;
    if (!isRecord(data)) {
      return {};
    }

    const inventoryView = getRecord(data, "inventoryView");
    const attributes = getRecord(inventoryView, "attributes");
    const vehicleInformation = listValues(getRecord(inventoryView, "vehicleInformation"));
    const vehicleDescription = listValues(getRecord(inventoryView, "vehicleDescription"));
    const saleInformation = listValues(getRecord(inventoryView, "saleInformation"));
    const imageDimensions = getRecord(inventoryView, "imageDimensions");

    const runAndDrive = pickString(attributes, ["RunAndDrive"]);
    const startText =
      truthyString(runAndDrive) === true
        ? "Run and Drive"
        : pickString(attributes, ["StartsDesc", "StartCode", "EngineStarts1"]) ??
          pickKeyedValue(vehicleInformation, ["StartCode", "Starts", "EngineStarts"]);

    return withoutUndefined({
      engine:
        pickString(attributes, ["EngineSize", "EngineInformation", "EngineInfo"]) ??
        pickKeyedValue(vehicleDescription, ["Engine"]),
      exteriorColor: pickString(attributes, ["ExteriorColor", "Color"]),
      imageUrl: extractIaaiImageUrl(imageDimensions, pageUrl),
      interiorColor: pickString(attributes, ["InteriorColor"]),
      runStatus: startText ? normalizeRunStatus(startText) : undefined,
      saleDate: normalizeIaaiAuctionDate(
        pickKeyedValue(saleInformation, ["AuctionDateTime"]) ??
          pickString(attributes, ["AuctionDateTime"]),
      ),
    });
  } catch {
    return {};
  }
}

function extractIaaiImageUrl(
  imageDimensions: Record<string, unknown> | undefined,
  pageUrl: string,
): string | undefined {
  const keys = listValues(getRecord(imageDimensions, "keys"));
  const firstKey = keys
    .map((item) => pickString(item, ["k", "K", "key", "imageKey"]))
    .find(Boolean);

  if (!firstKey) {
    return undefined;
  }

  return resolveImageUrl(
    `https://vis.iaai.com/resizer?imageKeys=${encodeURIComponent(
      firstKey,
    )}&width=640&height=480`,
    pageUrl,
  );
}

function mergeDefinedVehicleFields(
  vehicle: AuctionVehicle,
  details: ListingDetails,
): AuctionVehicle {
  return {
    ...vehicle,
    engine: details.engine ?? vehicle.engine,
    exteriorColor: details.exteriorColor ?? vehicle.exteriorColor,
    imageUrl: details.imageUrl ?? vehicle.imageUrl,
    interiorColor: details.interiorColor ?? vehicle.interiorColor,
    runStatus: details.runStatus ?? vehicle.runStatus,
    saleDate: details.saleDate ?? vehicle.saleDate,
  };
}

function withoutUndefined(details: ListingDetails): ListingDetails {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  ) as ListingDetails;
}

function getRecord(
  value: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const child = value[key];
  return isRecord(child) ? child : undefined;
}

function listValues(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  const values = value.$values;
  if (Array.isArray(values)) {
    return values.filter(isRecord);
  }

  return [];
}

function pickString(
  item: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!item) {
    return undefined;
  }

  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "boolean") {
      return String(value);
    }
  }

  return undefined;
}

function pickKeyedValue(
  items: Record<string, unknown>[],
  keys: string[],
): string | undefined {
  const normalizedKeys = keys.map(normalizeKey);

  for (const item of items) {
    const key = pickString(item, ["key", "Key"]);
    const value = pickString(item, ["value", "Value"]);
    if (key && value && normalizedKeys.includes(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function truthyString(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function normalizeIaaiAuctionDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized || /not ready|available|tbd|pending/i.test(normalized)) {
    return undefined;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() <= 1900) {
    return undefined;
  }

  return parsed.toISOString();
}

function resolveImageUrl(
  candidate: string | undefined,
  pageUrl: string,
): string | undefined {
  if (!candidate?.trim()) {
    return undefined;
  }

  try {
    return new URL(candidate.trim(), pageUrl).toString();
  } catch {
    return undefined;
  }
}
