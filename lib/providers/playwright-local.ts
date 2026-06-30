import type { Browser, Page } from "playwright";
import type { AppEnv } from "../env";
import { matchesSantaFeCalligraphy } from "../filter";
import {
  extractListingDetailsFromHtml,
  type ListingDetails,
} from "../listing-image";
import type { AuctionSource, AuctionVehicle } from "../types";
import {
  buildCopartSearchUrls,
  buildIaaiSearchUrls,
  type ProviderContext,
} from "./shared";
import { extractVehiclesFromSearchHtml } from "./search-html";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "Chrome/125.0.0.0 Safari/537.36";
const SEARCH_TIMEOUT_MS = 60_000;
const DETAIL_TIMEOUT_MS = 45_000;
const DETAIL_CONCURRENCY = 4;
const COPART_DETAIL_CONCURRENCY = 1;

type LocalPlaywrightContext = ProviderContext & {
  browser: Browser;
};

type FetchRenderedVehiclesOptions = {
  browser: Browser;
  env: AppEnv;
  source: AuctionSource;
  urls: string[];
};

type LocalDetailPolicy = {
  concurrency: number;
  delayMs: number;
  limit: number;
};

export async function fetchLocalCopartVehicles({
  env,
  browser,
}: LocalPlaywrightContext): Promise<AuctionVehicle[]> {
  return fetchRenderedVehicles({
    browser,
    env,
    source: "copart",
    urls: buildCopartSearchUrls(env),
  });
}

export async function fetchLocalIaaiVehicles({
  env,
  browser,
}: LocalPlaywrightContext): Promise<AuctionVehicle[]> {
  return fetchRenderedVehicles({
    browser,
    env,
    source: "iaai",
    urls: buildIaaiSearchUrls(env),
  });
}

export function mergeVehicleDetails(
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

async function fetchRenderedVehicles({
  browser,
  env,
  source,
  urls,
}: FetchRenderedVehiclesOptions): Promise<AuctionVehicle[]> {
  const vehicles: AuctionVehicle[] = [];
  const page = await newPage(browser);

  try {
    for (const url of urls) {
      if (vehicles.length >= env.MAX_RESULTS_PER_SOURCE) {
        break;
      }

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: SEARCH_TIMEOUT_MS,
      });
      await dismissCookieBanner(page);
      await waitForSearchPage(page, source);
      await scrollSearchResults(page);

      const html = await page.content();
      vehicles.push(
        ...extractVehiclesFromSearchHtml(
          source,
          html,
          page.url(),
          env.MAX_RESULTS_PER_SOURCE - vehicles.length,
        ),
      );
    }
  } finally {
    await page.close();
  }

  return enrichVehiclesWithDetails(
    browser,
    source,
    dedupeVehicles(vehicles).slice(0, env.MAX_RESULTS_PER_SOURCE),
    env,
  );
}

async function enrichVehiclesWithDetails(
  browser: Browser,
  source: AuctionSource,
  vehicles: AuctionVehicle[],
  env: AppEnv,
): Promise<AuctionVehicle[]> {
  const policy = getLocalDetailPolicy(source, env);
  const detailVehicles = selectDetailVehicles(source, vehicles, env).slice(
    0,
    policy.limit,
  );
  const enrichedVehicles = await mapWithConcurrency(
    detailVehicles,
    policy.concurrency,
    async (vehicle, index) => {
      if (policy.delayMs > 0 && index > 0) {
        await sleep(policy.delayMs);
      }

      const page = await newPage(browser);

      try {
        await page.goto(vehicle.url, {
          waitUntil: "domcontentloaded",
          timeout: DETAIL_TIMEOUT_MS,
        });
        await waitForDetailPage(page, vehicle.source);

        const html = await page.content();
        return mergeVehicleDetails(
          vehicle,
          extractListingDetailsFromHtml(html, vehicle.url),
        );
      } catch {
        return vehicle;
      } finally {
        await page.close();
      }
    },
  );
  const enrichedById = new Map(
    enrichedVehicles.map((vehicle) => [vehicle.id, vehicle]),
  );

  return vehicles.map((vehicle) => enrichedById.get(vehicle.id) ?? vehicle);
}

export function getLocalDetailPolicy(
  source: AuctionSource,
  env: Pick<AppEnv, "COPART_DETAIL_DELAY_MS" | "COPART_DETAIL_PAGE_LIMIT">,
): LocalDetailPolicy {
  if (source === "copart") {
    return {
      concurrency: COPART_DETAIL_CONCURRENCY,
      delayMs: env.COPART_DETAIL_DELAY_MS,
      limit: env.COPART_DETAIL_PAGE_LIMIT,
    };
  }

  return {
    concurrency: DETAIL_CONCURRENCY,
    delayMs: 0,
    limit: Number.POSITIVE_INFINITY,
  };
}

export function selectDetailVehicles(
  source: AuctionSource,
  vehicles: AuctionVehicle[],
  env: Pick<AppEnv, "COPART_DETAIL_PAGE_LIMIT" | "MIN_YEAR">,
): AuctionVehicle[] {
  if (source !== "copart") {
    return vehicles;
  }

  return vehicles
    .filter((vehicle) =>
      matchesSantaFeCalligraphy(vehicle, { minYear: env.MIN_YEAR }),
    )
    .slice(0, env.COPART_DETAIL_PAGE_LIMIT);
}

async function newPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage({
    userAgent: USER_AGENT,
    viewport: { width: 1365, height: 900 },
  });
  page.setDefaultTimeout(20_000);
  return page;
}

async function waitForSearchPage(page: Page, source: AuctionSource): Promise<void> {
  const selector =
    source === "iaai"
      ? "a[href*='/VehicleDetail/']"
      : "a[href*='/lot/']";

  await page.locator(selector).first().waitFor({ timeout: 20_000 }).catch(() => {
    // Some auction pages render useful JSON but no stable anchors.
  });
}

async function dismissCookieBanner(page: Page): Promise<void> {
  await page
    .getByText("Accept All Cookies", { exact: true })
    .click({ timeout: 5_000 })
    .catch(() => {
      // Cookie prompts are not always shown after the first local run.
    });
}

async function waitForDetailPage(page: Page, source: AuctionSource): Promise<void> {
  if (source !== "iaai") {
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {
      // Detail pages often keep analytics requests open.
    });
    return;
  }

  await page.locator("#ProductDetailsVM").waitFor({ timeout: 20_000 }).catch(() => {
    // Keep the listing if IAAI serves a partial page.
  });
}

async function scrollSearchResults(page: Page): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(500);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dedupeVehicles(vehicles: AuctionVehicle[]): AuctionVehicle[] {
  const byId = new Map<string, AuctionVehicle>();

  for (const vehicle of vehicles) {
    byId.set(vehicle.id, vehicle);
  }

  return [...byId.values()];
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}
