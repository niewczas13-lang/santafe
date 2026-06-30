import { NextResponse } from "next/server";
import { getEnvValidationMessage, loadEnv, type AppEnv } from "@/lib/env";
import { runAuctionCheck } from "@/lib/check-auctions";
import { fetchCopartVehicles } from "@/lib/providers/copart";
import { fetchIaaiVehicles } from "@/lib/providers/iaai";
import type { AuctionSource, AuctionVehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleCheck(request);
}

export async function POST(request: Request) {
  return handleCheck(request);
}

async function handleCheck(request: Request) {
  let env: AppEnv;

  try {
    env = loadEnv();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getEnvValidationMessage(error) },
      { status: 500 },
    );
  }

  if (!(await isAuthorized(request, env.CRON_SECRET))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const sources: Array<{
    source: AuctionSource;
    enabled: boolean;
    fetchVehicles: () => Promise<AuctionVehicle[]>;
  }> = [
    {
      source: "copart",
      enabled: env.ENABLE_COPART,
      fetchVehicles: () => fetchCopartVehicles({ env }),
    },
    {
      source: "iaai",
      enabled: env.ENABLE_IAAI,
      fetchVehicles: () => fetchIaaiVehicles({ env }),
    },
  ];

  const summary = await runAuctionCheck({ env, sources });
  return NextResponse.json(summary);
}

async function isAuthorized(
  request: Request,
  cronSecret: string,
): Promise<boolean> {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authorization = request.headers.get("authorization");
  const bearerSecret = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const bodySecret = await getBodySecret(request);

  return (
    querySecret === cronSecret ||
    bearerSecret === cronSecret ||
    bodySecret === cronSecret
  );
}

async function getBodySecret(request: Request): Promise<string | null> {
  if (request.method === "GET") {
    return null;
  }

  try {
    const body = (await request.clone().json()) as { secret?: unknown };
    return typeof body.secret === "string" ? body.secret : null;
  } catch {
    return null;
  }
}
