import { getRedis } from "./storage";

type VinDecodeResult = {
  trim?: string;
  series?: string;
};

const VIN_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function decodeVinValues(
  vin: string,
): Promise<VinDecodeResult | null> {
  const normalizedVin = vin.trim().toUpperCase();
  if (normalizedVin.length < 11) {
    return null;
  }

  const cacheKey = `auction-alerts:vin:${normalizedVin}`;
  const redis = getRedis();
  const cached = await redis.get<VinDecodeResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const url = new URL(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(
      normalizedVin,
    )}`,
  );
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NHTSA VIN decode returned ${response.status}`);
  }

  const data = (await response.json()) as {
    Results?: Array<Record<string, string>>;
  };
  const result = data.Results?.[0];
  const decoded = {
    trim: cleanValue(result?.Trim),
    series: cleanValue(result?.Series),
  };

  await redis.set(cacheKey, decoded, { ex: VIN_CACHE_TTL_SECONDS });
  return decoded;
}

function cleanValue(value: string | undefined): string | undefined {
  if (!value || value.trim() === "" || value.trim().toLowerCase() === "not applicable") {
    return undefined;
  }

  return value.trim();
}
