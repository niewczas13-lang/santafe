import * as cheerio from "cheerio";
import type { AppEnv } from "../env";
import type { AuctionSource, AuctionVehicle } from "../types";

type UnknownRecord = Record<string, unknown>;

const DEFAULT_COPART_SEARCH_URL =
  "https://www.copart.com/lotSearchResults/?free=true&query=hyundai%20santa%20fe%20calligraphy";
const DEFAULT_IAAI_SEARCH_URL =
  "https://www.iaai.com/Search?Keyword=hyundai%20santa%20fe%20calligraphy";

export type ProviderContext = {
  env: AppEnv;
};

export type ProviderFetch = (context: ProviderContext) => Promise<AuctionVehicle[]>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeVehicle(
  source: AuctionSource,
  item: unknown,
  fallbackUrl = "",
): AuctionVehicle | null {
  if (!isRecord(item)) {
    return null;
  }

  const lotNumber = pickString(item, [
    "lotNumber",
    "lot",
    "lot_number",
    "lotId",
    "lot_id",
    "lotNo",
  ]);
  const stockNumber = pickString(item, [
    "stockNumber",
    "stock",
    "stock_number",
    "stockNo",
    "inventoryId",
  ]);
  const vin = pickString(item, ["vin", "VIN", "vehicleVin"]);
  const title =
    pickString(item, ["title", "name", "vehicleTitle", "description"]) ??
    buildTitle(item);
  const url =
    pickString(item, [
      "url",
      "link",
      "href",
      "vehicleUrl",
      "lotUrl",
      "detailUrl",
    ]) ?? fallbackUrl;

  if (!title || !url) {
    return null;
  }

  return {
    id: buildVehicleId(source, lotNumber, stockNumber, vin, url),
    source,
    lotNumber,
    stockNumber,
    vin,
    year: pickNumber(item, ["year", "vehicleYear", "modelYear"]) ?? yearFromTitle(title),
    make: pickString(item, ["make", "vehicleMake", "manufacturer"]),
    model: pickString(item, ["model", "vehicleModel"]),
    trim: pickString(item, ["trim", "series", "subModel", "vehicleTrim"]),
    title,
    odometer: pickString(item, ["odometer", "mileage", "odo"]),
    damage: pickString(item, ["damage", "primaryDamage", "lossType"]),
    location: pickString(item, ["location", "yardLocation", "branch", "city"]),
    saleDate: pickString(item, ["saleDate", "auctionDate", "saleTime"]),
    currentBid: pickString(item, ["currentBid", "bid", "highBid", "preBid"]),
    buyNowPrice: pickString(item, ["buyNowPrice", "buyNow", "price"]),
    imageUrl: pickString(item, ["imageUrl", "image", "thumbnail", "photoUrl"]),
    url,
    raw: item,
  };
}

export async function fetchVehiclesFromUrls(
  source: AuctionSource,
  urls: string[],
  limit: number,
): Promise<AuctionVehicle[]> {
  const vehicles: AuctionVehicle[] = [];

  for (const url of urls) {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/json",
        "user-agent":
          "Mozilla/5.0 auction-alerts/1.0 (+https://vercel.com/serverless)",
      },
      next: { revalidate: 0 },
    });

    if (response.status === 403 || response.status === 429) {
      throw new Error(`${source} blocked the saved-search request`);
    }

    if (!response.ok) {
      throw new Error(`${source} saved-search URL returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    const items = contentType.includes("application/json")
      ? collectVehicleCandidates(JSON.parse(body))
      : collectVehicleCandidatesFromHtml(body);

    for (const item of items) {
      const vehicle = normalizeVehicle(source, item, url);
      if (vehicle) {
        vehicles.push(vehicle);
      }

      if (vehicles.length >= limit) {
        return vehicles;
      }
    }
  }

  if (urls.length > 0 && vehicles.length === 0) {
    throw new Error(
      `${source} returned an unexpected format. Use Apify or update the saved-search URL.`,
    );
  }

  return vehicles;
}

export function buildCopartActorInput(env: AppEnv) {
  return {
    startUrl: env.COPART_SEARCH_URLS[0] ?? DEFAULT_COPART_SEARCH_URL,
    maxItems: env.MAX_RESULTS_PER_SOURCE,
  };
}

export function buildIaaiActorInput(env: AppEnv) {
  return {
    urls:
      env.IAAI_SEARCH_URLS.length > 0
        ? env.IAAI_SEARCH_URLS
        : [DEFAULT_IAAI_SEARCH_URL],
    maxitems: env.MAX_RESULTS_PER_SOURCE,
  };
}

export function takeMax<T>(items: T[], max: number): T[] {
  return items.slice(0, Math.max(0, max));
}

function pickString(item: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];

    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function pickNumber(item: UnknownRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = item[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function buildTitle(item: UnknownRecord): string {
  return [
    pickString(item, ["year", "vehicleYear", "modelYear"]),
    pickString(item, ["make", "vehicleMake", "manufacturer"]),
    pickString(item, ["model", "vehicleModel"]),
    pickString(item, ["trim", "series", "subModel", "vehicleTrim"]),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildVehicleId(
  source: AuctionSource,
  lotNumber: string | undefined,
  stockNumber: string | undefined,
  vin: string | undefined,
  url: string,
): string {
  if (lotNumber) {
    return `${source}:lot:${lotNumber}`;
  }

  if (stockNumber) {
    return `${source}:stock:${stockNumber}`;
  }

  return `${source}:${vin ?? "no-vin"}:${url}`;
}

function yearFromTitle(title: string): number | undefined {
  const match = title.match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function collectVehicleCandidatesFromHtml(html: string): unknown[] {
  const $ = cheerio.load(html);
  const candidates: unknown[] = [];

  $("script[type='application/ld+json'], script#__NEXT_DATA__").each(
    (_index, element) => {
      const text = $(element).text();
      if (!text.trim()) {
        return;
      }

      try {
        candidates.push(...collectVehicleCandidates(JSON.parse(text)));
      } catch {
        // Ignore unrelated JSON scripts.
      }
    },
  );

  return candidates;
}

function collectVehicleCandidates(input: unknown): unknown[] {
  const found: unknown[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    if (looksLikeVehicle(value)) {
      found.push(value);
    }

    for (const nested of Object.values(value)) {
      if (Array.isArray(nested) || isRecord(nested)) {
        visit(nested);
      }
    }
  };

  visit(input);
  return found;
}

function looksLikeVehicle(item: UnknownRecord): boolean {
  return Boolean(
    pickString(item, ["vin", "VIN", "lotNumber", "stockNumber", "title"]) ||
      (pickString(item, ["make", "vehicleMake"]) &&
        pickString(item, ["model", "vehicleModel"])),
  );
}
