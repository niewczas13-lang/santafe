import { loadEnv, type AppEnv } from "./env";
import type { AuctionVehicle } from "./types";

export async function sendTelegramAlert(
  vehicle: AuctionVehicle,
  env: AppEnv = loadEnv(),
): Promise<void> {
  await sendTelegramMessage(formatVehicleMessage(vehicle), env);
}

export async function sendTelegramMessage(
  html: string,
  env: AppEnv = loadEnv(),
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
  }
}

export function formatVehicleMessage(vehicle: AuctionVehicle): string {
  const heading = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
  ]
    .filter(Boolean)
    .join(" ");

  const lines = [
    `<b>New ${escapeHtml(vehicle.source.toUpperCase())} match</b>`,
    escapeHtml(heading || vehicle.title),
    field("Lot", vehicle.lotNumber),
    field("Stock", vehicle.stockNumber),
    field("Location", vehicle.location),
    field("Damage", vehicle.damage),
    field("Odometer", vehicle.odometer),
    field("Current bid", vehicle.currentBid),
    field("Buy now", vehicle.buyNowPrice),
    field("Sale date", vehicle.saleDate),
    `<a href="${escapeAttribute(vehicle.url)}">Open listing</a>`,
  ];

  return lines.filter(Boolean).join("\n");
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function field(label: string, value: unknown): string | null {
  if (value == null || String(value).trim() === "") {
    return null;
  }

  return `<b>${escapeHtml(label)}:</b> ${escapeHtml(value)}`;
}
