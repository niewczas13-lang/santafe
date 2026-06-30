import { NextResponse } from "next/server";
import { getEnvValidationMessage, loadEnv } from "@/lib/env";
import { setWatchedVehicle } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    loadEnv();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getEnvValidationMessage(error) },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as {
      id?: unknown;
      watched?: unknown;
    };

    if (typeof body.id !== "string" || body.id.trim() === "") {
      return NextResponse.json(
        { ok: false, error: "Vehicle id is required" },
        { status: 400 },
      );
    }

    await setWatchedVehicle(body.id.trim(), body.watched === true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
