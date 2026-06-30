import { NextResponse } from "next/server";
import { getEnvValidationMessage, loadEnv } from "@/lib/env";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const env = loadEnv();

    if (process.env.NODE_ENV !== "development" && !env.ENABLE_DEBUG_ROUTES) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    if (!isAuthorized(request, env.CRON_SECRET)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await sendTelegramMessage(
      "<b>Santa Fe Auction Alerts test</b>\nTelegram delivery is configured.",
      env,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getEnvValidationMessage(error) },
      { status: 500 },
    );
  }
}

function isAuthorized(request: Request, cronSecret: string): boolean {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authorization = request.headers.get("authorization");
  const bearerSecret = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  return querySecret === cronSecret || bearerSecret === cronSecret;
}
