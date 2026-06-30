import type { AuctionVehicle } from "./types";

export function buildIaaiImageUrlFromDetailUrl(
  detailUrl: string | undefined,
): string | undefined {
  if (!detailUrl) {
    return undefined;
  }

  const match = detailUrl.match(/\/VehicleDetail\/(\d+)(?:~[A-Z]+)?/i);
  if (!match) {
    return undefined;
  }

  return `https://vis.iaai.com/resizer?imageKeys=${match[1]}~SID&width=640&height=480`;
}

export function getVehicleImageUrl(vehicle: AuctionVehicle): string | undefined {
  return (
    vehicle.imageUrl ??
    (vehicle.source === "iaai"
      ? buildIaaiImageUrlFromDetailUrl(vehicle.url)
      : undefined)
  );
}
