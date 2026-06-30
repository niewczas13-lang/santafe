import { NextResponse } from "next/server";
import { getEnvValidationMessage, loadEnv } from "@/lib/env";
import { normalizeAuctionFilters } from "@/lib/filter-settings";
import { getAuctionFilters, saveAuctionFilters } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    loadEnv();
    const filters = await getAuctionFilters();
    return NextResponse.json({ ok: true, filters });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getEnvValidationMessage(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    loadEnv();
    const body = (await request.json()) as {
      filters?: unknown;
    };

    const filters = await saveAuctionFilters(
      normalizeAuctionFilters(body.filters),
    );
    return NextResponse.json({ ok: true, filters });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getEnvValidationMessage(error) },
      { status: 500 },
    );
  }
}
