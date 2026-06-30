import { NextResponse } from "next/server";
import { getEnvValidationMessage, loadEnv } from "@/lib/env";
import {
  enqueueManualCheckRequest,
  getManualCheckStatus,
  type ManualCheckSource,
} from "@/lib/manual-check";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    loadEnv();
    const status = await getManualCheckStatus();
    return NextResponse.json({ ok: true, status });
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
    const source = await getRequestedSource(request);
    const manualRequest = await enqueueManualCheckRequest({ source });

    return NextResponse.json({
      ok: true,
      queued: true,
      request: manualRequest,
      message:
        "Manual check queued. The local listener will run it when your computer is online.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getEnvValidationMessage(error) },
      { status: 500 },
    );
  }
}

async function getRequestedSource(request: Request): Promise<ManualCheckSource> {
  try {
    const body = (await request.json()) as { source?: unknown };
    return body.source === "copart" || body.source === "iaai"
      ? body.source
      : "all";
  } catch {
    return "all";
  }
}
