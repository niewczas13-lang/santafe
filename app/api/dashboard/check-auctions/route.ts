import { NextResponse } from "next/server";
import { getEnvValidationMessage, loadEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const env = loadEnv();
    const url = new URL("/api/cron/check-auctions", request.url);
    url.searchParams.set("secret", env.CRON_SECRET);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CRON_SECRET}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as unknown;
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getEnvValidationMessage(error) },
      { status: 500 },
    );
  }
}
