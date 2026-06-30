import * as cheerio from "cheerio";
import type { AuctionVehicle } from "./types";

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

  return undefined;
}

export async function enrichVehicleImage(
  vehicle: AuctionVehicle,
): Promise<AuctionVehicle> {
  if (vehicle.imageUrl) {
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

    const imageUrl = extractListingImageUrl(await response.text(), vehicle.url);
    return imageUrl ? { ...vehicle, imageUrl } : vehicle;
  } catch {
    return vehicle;
  }
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
