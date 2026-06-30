import * as cheerio from "cheerio";
import { buildIaaiImageUrlFromDetailUrl } from "../image-url";
import type { AuctionSource, AuctionVehicle } from "../types";
import { normalizeVehicle } from "./shared";

type Candidate = Record<string, unknown>;

export function extractVehiclesFromSearchHtml(
  source: AuctionSource,
  html: string,
  pageUrl: string,
  limit: number,
): AuctionVehicle[] {
  const candidates =
    source === "iaai"
      ? extractIaaiCandidates(html, pageUrl)
      : extractGenericCandidates(html, pageUrl);

  return candidates
    .map((candidate) => normalizeVehicle(source, candidate, pageUrl))
    .filter((vehicle): vehicle is AuctionVehicle => vehicle !== null)
    .slice(0, Math.max(0, limit));
}

function extractIaaiCandidates(html: string, pageUrl: string): Candidate[] {
  const $ = cheerio.load(html);
  const byUrl = new Map<string, Candidate>();

  $("a[href*='/VehicleDetail/']").each((_index, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    const url = resolveUrl(href, pageUrl);

    if (!url) {
      return;
    }

    const candidate = byUrl.get(url) ?? { url };
    const stockNumber =
      extractNumber(anchor.attr("name")) ??
      extractNumber(anchor.attr("id")) ??
      extractNumber(href);
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

  return [...byUrl.values()].filter((candidate) => typeof candidate.title === "string");
}

function extractGenericCandidates(html: string, pageUrl: string): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];

  $("a[href]").each((_index, element) => {
    const anchor = $(element);
    const title = normalizeHtmlText(anchor.text());
    const url = resolveUrl(anchor.attr("href"), pageUrl);

    if (!url || !looksLikeVehicleTitle(title)) {
      return;
    }

    candidates.push({
      title,
      url,
      lotNumber: extractNumber(url),
    });
  });

  return candidates;
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

function extractNumber(value: string | undefined): string | undefined {
  const match = value?.match(/\d{5,}/);
  return match?.[0];
}

function normalizeHtmlText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeVehicleTitle(value: string): boolean {
  return /\b(19|20)\d{2}\b/.test(value) || /hyundai|santa|calligraphy/i.test(value);
}
