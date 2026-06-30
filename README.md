# Santa Fe Auction Alerts

Serverless Next.js app for Vercel that checks Copart and IAAI for Hyundai Santa Fe Calligraphy listings from 2024 onward and sends Telegram alerts for new matches.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` for the dashboard.

## Environment

Required:

- `CRON_SECRET`: shared secret for cron and debug endpoints.
- `TELEGRAM_BOT_TOKEN`: Telegram bot token from BotFather.
- `TELEGRAM_CHAT_ID`: chat ID where alerts should be sent.
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL.
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token.

Optional:

- `MIN_YEAR`: defaults to `2024`.
- `ENABLE_COPART`: defaults to `true`.
- `ENABLE_IAAI`: defaults to `true`.
- `COPART_SEARCH_URLS`: comma-separated saved-search URLs.
- `IAAI_SEARCH_URLS`: comma-separated saved-search URLs.
- `APIFY_TOKEN`: enables Apify provider mode.
- `APIFY_COPART_ACTOR_ID`: optional override. Defaults to `parseforge/copart-public-search-scraper` when `APIFY_TOKEN` is set.
- `APIFY_IAAI_ACTOR_ID`: optional override. Defaults to `delectable_incubator/iaai-vehicles-scraper-low-cost` when `APIFY_TOKEN` is set.
- `FIRST_RUN_NOTIFY`: defaults to `false`.
- `MAX_RESULTS_PER_SOURCE`: defaults to `200`.
- `ENABLE_DEBUG_ROUTES`: enables `/api/debug/test-telegram` outside local development.

## Telegram

1. Open Telegram and message `@BotFather`.
2. Create a bot with `/newbot`.
3. Put the token in `TELEGRAM_BOT_TOKEN`.
4. Send a message to your bot or add it to a group.
5. Get your chat ID from `https://api.telegram.org/botYOUR_TOKEN/getUpdates`.
6. Put the ID in `TELEGRAM_CHAT_ID`.

Test delivery locally:

```bash
curl "http://localhost:3000/api/debug/test-telegram?secret=YOUR_CRON_SECRET"
```

## Upstash Redis

On Vercel, add Upstash Redis from the Marketplace or create a Redis database in Upstash. Copy the REST URL and REST token into Vercel environment variables.

The app stores:

- `auction-alerts:seen`: IDs already processed.
- `auction-alerts:recent`: up to 500 recent matched listings shown on the dashboard.
- `auction-alerts:last-check`: last cron summary.
- `auction-alerts:vin:<vin>`: VIN decode cache for 30 days.

## Auction Sources

Use Apify by setting `APIFY_TOKEN`. If you do not set actor IDs, the app uses:

- Copart: `parseforge/copart-public-search-scraper`
- IAAI: `delectable_incubator/iaai-vehicles-scraper-low-cost`

You can override either actor through `APIFY_COPART_ACTOR_ID` or `APIFY_IAAI_ACTOR_ID`.

IAAI thumbnails are derived from the `VehicleDetail` salvage ID when the actor does not return image URLs. If the configured IAAI actor returns no usable listings, the app also tries the default low-cost actor and then the detail-capable `lulzasaur/iaa-scraper` actor before falling back to saved-search HTML. The detail actor receives `keyword`, `maxResults`, and `scrapeDetails`.

Without Apify, paste saved-search URLs into `COPART_SEARCH_URLS` and `IAAI_SEARCH_URLS`. Saved URLs should already contain your filters for Hyundai Santa Fe Calligraphy, 2024+, USA and Canada. Auction sites may block serverless fetches; in that case use Apify or adjust the saved-search source.

## Free Local Playwright Checks

For a free twice-daily setup, keep Vercel as the dashboard and run the scraper on your Windows machine with Playwright. This avoids Apify usage limits and uses the same Redis, filters, recent listings, and Telegram alerts as the Vercel cron.

Install local browser binaries once:

```powershell
npm run install:local-browsers
```

Run a manual local check:

```powershell
npm run check:local
```

Run only one source:

```powershell
npm run check:local -- --source=iaai
npm run check:local -- --source=copart
```

Install Windows Task Scheduler jobs for 08:00 and 20:00 local time:

```powershell
npm run schedule:local
```

This also installs and starts `SantaFeAuctionManualListener`, a local listener that polls Redis for manual check requests from the Vercel dashboard. When you click **Sprawdz teraz** in the dashboard, Vercel queues a request in Redis. If your computer is on and the listener is running, it claims that request and runs the local Playwright check.

Start or reinstall only the manual listener:

```powershell
npm run schedule:listener
```

The scheduled commands write logs to `.local-logs/`. Copart currently needs a normal local Chromium window, so scheduled `check:local` and dashboard-triggered manual checks run headed by default. Set `LOCAL_LISTENER_HEADLESS=true` only if you want manual dashboard checks to run without a visible browser window; IAAI works headless, but Copart may return no listings in that mode.

Copart is conservative locally: it only opens likely Calligraphy detail pages, one at a time. Tune this if Copart shows bot checks:

```env
COPART_DETAIL_PAGE_LIMIT=8
COPART_DETAIL_DELAY_MS=2500
```

## Dashboard Filters

The dashboard lets you save practical filters in Redis without redeploying:

- exterior color
- excluded interior/upholstery color, default `black`
- engine text, default `hybrid`
- max engine displacement, default below `2.0`
- required Calligraphy trim, always enabled
- vehicle run status: runs and drives, starts, stationary, or no info

Use **Sprawdź teraz** to save the current filters and run the auction check immediately. The dashboard endpoint uses `CRON_SECRET` server-side, so the UI does not ask for the secret.

## Cron

The included `vercel.json` runs once per day at 08:00 UTC:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-auctions",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Vercel Hobby supports daily cron. For 15-minute checks, upgrade to Vercel Pro and change the schedule to `*/15 * * * *`, or keep the Vercel deployment and use an external cron service:

```text
https://YOUR_DOMAIN/api/cron/check-auctions?secret=YOUR_CRON_SECRET
```

The endpoint also accepts:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

## First Run

On the first successful run, `FIRST_RUN_NOTIFY=false` marks all current matches as seen without sending Telegram alerts. Later runs alert only for newly discovered IDs. Set `FIRST_RUN_NOTIFY=true` to notify for all matches on the first run.

Deduplication uses `source + lotNumber`, then `source + stockNumber`, then `source + vin + url`.

## Deploy To Vercel

1. Push this project to GitHub.
2. Import it in Vercel.
3. Add the required environment variables.
4. Add Upstash Redis from the Vercel Marketplace or paste existing Upstash credentials.
5. Deploy.
6. Run the cron endpoint manually once to confirm Redis and Telegram are configured.

## Troubleshooting

- `Unauthorized`: the cron secret is missing or does not match.
- `Environment setup needed`: one or more required env vars are missing or invalid.
- `blocked the saved-search request`: Copart or IAAI rejected direct serverless scraping. Use Apify or a different saved-search source.
- No alerts on the first run: expected when `FIRST_RUN_NOTIFY=false`.
- Duplicate alerts: verify that listings include stable lot or stock numbers.

Respect auction site terms, robots rules, and rate limits. Keep checks modest and avoid aggressive scraping.
