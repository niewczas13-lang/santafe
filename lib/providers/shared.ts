import * as cheerio from "cheerio";
import type { AppEnv } from "../env";
import { buildIaaiImageUrlFromDetailUrl } from "../image-url";
import type { AuctionSource, AuctionVehicle, VehicleRunStatus } from "../types";

type UnknownRecord = Record<string, unknown>;

const DEFAULT_COPART_SEARCH_URL =
  "https://www.copart.com/lotSearchResults/?free=true&query=hyundai%20santa%20fe%20calligraphy";
const DEFAULT_IAAI_SEARCH_URL =
  "https://www.iaai.com/Search?Keyword=hyundai%20santa%20fe%20calligraphy";
export const IAAI_DETAIL_ACTOR_ID = "lulzasaur/iaa-scraper";

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
    "Stock #",
    "stock #",
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
      "item_url",
      "vehicleUrl",
      "lotUrl",
      "detailUrl",
      "detail_url",
      "Detail URL",
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
    odometer: pickOdometer(item),
    exteriorColor: pickString(item, [
      "exteriorColor",
      "exterior_color",
      "Exterior Color",
      "color",
      "Color",
      "vehicleColor",
    ]),
    interiorColor: pickString(item, [
      "interiorColor",
      "interior_color",
      "Interior Color",
      "interior",
      "Interior",
    ]),
    engine: pickString(item, [
      "engine",
      "Engine",
      "engine_type",
      "Engine Type",
      "engineSize",
      "engine_size",
      "fuel",
      "Fuel",
    ]),
    runStatus: normalizeRunStatus(
      pickString(item, [
        "runStatus",
        "run_status",
        "startCode",
        "Start Code",
        "StartCode",
        "startsDesc",
        "StartsDesc",
        "vehicle_condition",
        "Vehicle Condition",
        "RunAndDrive",
        "runAndDrive",
        "Run & Drive",
        "starts",
        "Starts",
        "condition",
        "Condition",
      ]),
    ),
    damage: pickString(item, [
      "damage",
      "primaryDamage",
      "primary_damage",
      "Primary Damage",
      "lossType",
      "loss_type",
    ]),
    location: pickString(item, [
      "location",
      "sale_location",
      "yardLocation",
      "branch",
      "Branch",
      "city",
    ]),
    saleDate: pickString(item, [
      "saleDate",
      "auctionDate",
      "auction_date",
      "auctionDateTime",
      "AuctionDateTime",
      "Auction Date",
      "Sale Date",
      "Date/Time",
      "saleTime",
      "sale_time",
    ]),
    currentBid: pickString(item, [
      "currentBid",
      "current_bid",
      "bid",
      "highBid",
      "preBid",
    ]),
    buyNowPrice: pickString(item, [
      "buyNowPrice",
      "buy_it_now_price",
      "buyNow",
      "price",
    ]),
    imageUrl: pickImageUrl(item),
    url,
    raw: item,
  };
}

export function normalizeRunStatus(value: string | undefined): VehicleRunStatus {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!normalized) {
    return "unknown";
  }

  if (
    normalized.includes("does not start") ||
    normalized.includes("non runner") ||
    normalized.includes("not run") ||
    normalized.includes("stationary")
  ) {
    return "stationary";
  }

  if (
    normalized.includes("start") ||
    normalized.includes("engine starts") ||
    normalized.includes("starts")
  ) {
    return "starts";
  }

  if (
    normalized.includes("run and drive") ||
    normalized.includes("runanddrive") ||
    normalized.includes("run drive") ||
    normalized.includes("runs and drives") ||
    normalized.includes("drives")
  ) {
    return "run_and_drive";
  }

  return "unknown";
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
      : collectVehicleCandidatesFromHtml(body, url);

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

export function buildIaaiActorInput(
  env: AppEnv,
  actorId = env.APIFY_IAAI_ACTOR_ID,
) {
  if (actorId === IAAI_DETAIL_ACTOR_ID) {
    return {
      keyword: "hyundai santa fe calligraphy",
      maxResults: env.MAX_RESULTS_PER_SOURCE,
      scrapeDetails: true,
    };
  }

  return {
    urls: buildIaaiSearchUrls(env),
    maxitems: env.MAX_RESULTS_PER_SOURCE,
  };
}

export function buildIaaiSearchUrls(env: AppEnv): string[] {
  return env.IAAI_SEARCH_URLS.length > 0
    ? env.IAAI_SEARCH_URLS
    : [DEFAULT_IAAI_SEARCH_URL];
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

function pickOdometer(item: UnknownRecord): string | undefined {
  const value = pickString(item, ["odometer", "Odometer", "mileage", "odo"]);
  const unit = pickString(item, ["odometer_unit", "odometerUnit"]);

  if (!value) {
    return undefined;
  }

  return unit ? `${value} ${unit}` : value;
}

function pickImageUrl(item: UnknownRecord): string | undefined {
  const direct = pickString(item, [
    "imageUrl",
    "image_url",
    "image",
    "thumbnail",
    "photoUrl",
    "photo_url",
  ]);

  if (direct) {
    return direct;
  }

  const recursive = findNestedImageUrl(item);
  if (recursive) {
    return recursive;
  }

  const iaaiFallback = buildIaaiImageUrlFromDetailUrl(
    pickString(item, [
      "url",
      "link",
      "href",
      "detailUrl",
      "detail_url",
      "Detail URL",
    ]),
  );
  if (iaaiFallback) {
    return iaaiFallback;
  }

  return undefined;
}

function findNestedImageUrl(value: unknown, depth = 0): string | undefined {
  if (depth > 4) {
    return undefined;
  }

  if (typeof value === "string") {
    return looksLikeImageUrl(value) ? value.trim() : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedImageUrl(item, depth + 1);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of ["images", "Images", "photos", "Photos", "lot_images"]) {
    const candidate = value[key];

    const found = findNestedImageUrl(candidate, depth + 1);
    if (found) {
      return found;
    }
  }

  for (const [key, candidate] of Object.entries(value)) {
    const keyLooksRelevant = /image|photo|thumb|src|url/i.test(key);
    if (!keyLooksRelevant) {
      continue;
    }

    const found = findNestedImageUrl(candidate, depth + 1);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function looksLikeImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) && /image|photo|img|vis\.iaai|copart/i.test(trimmed);
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

function collectVehicleCandidatesFromHtml(html: string, pageUrl: string): unknown[] {
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

  candidates.push(...collectIaaiVehicleCandidatesFromHtml($, pageUrl));

  return candidates;
}

function collectIaaiVehicleCandidatesFromHtml(
  $: cheerio.CheerioAPI,
  pageUrl: string,
): unknown[] {
  const byUrl = new Map<string, UnknownRecord>();

  $("a[href*='/VehicleDetail/']").each((_index, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    const url = resolveUrl(href, pageUrl);

    if (!url) {
      return;
    }

    const candidate = byUrl.get(url) ?? { url };
    const stockNumber =
      extractIaaiStockNumber(anchor.attr("name")) ??
      extractIaaiStockNumber(anchor.attr("id")) ??
      extractIaaiStockNumber(href);
    const title = normalizeHtmlText(anchor.text());

    if (stockNumber) {
      candidate.stockNumber = stockNumber;
    }

    if (title && looksLikeVehicleTitle(title)) {
      candidate.title = title;
    }

    const imageUrl = buildIaaiImageUrlFromDetailUrl(url);
    if (imageUrl) {
      candidate.imageUrl = imageUrl;
    }

    byUrl.set(url, candidate);
  });

  return [...byUrl.values()].filter((candidate) =>
    Boolean(pickString(candidate, ["title"])),
  );
}

function resolveUrl(candidate: string | undefined, pageUrl: string): string | undefined {
  if (!candidate?.trim()) {
    return undefined;
  }

  try {
    return new URL(candidate.trim(), pageUrl).toString();
  } catch {
    return undefined;
  }
}

function extractIaaiStockNumber(value: string | undefined): string | undefined {
  const match = value?.match(/\d{5,}/);
  return match?.[0];
}

function normalizeHtmlText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeVehicleTitle(value: string): boolean {
  return /\b(19|20)\d{2}\b/.test(value) || /hyundai|santa|calligraphy/i.test(value);
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
