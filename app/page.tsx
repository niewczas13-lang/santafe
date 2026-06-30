import { getEnvValidationMessage, loadEnv } from "@/lib/env";
import { getRecent, getStats } from "@/lib/storage";
import type { AuctionVehicle, DashboardStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const state = await loadDashboardState();

  if (!state.ok) {
    return <ConfigurationError message={state.error} />;
  }

  const { stats, recent } = state;

  return (
    <main className="min-h-[100dvh] px-4 py-8 text-[#20231d] sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="space-y-8">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f52]">
              Auction monitor
            </p>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                Santa Fe Calligraphy alerts
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#667161]">
                Watching Copart and IAAI for Hyundai Santa Fe Calligraphy
                listings from 2024 onward, including hybrid Calligraphy trims.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Metric label="Active filter" value="Hyundai Santa Fe 2024+" />
            <Metric label="Seen vehicles" value={String(stats.seenCount)} />
            <Metric
              label="Last check"
              value={formatDate(stats.lastCheck?.checkedAt)}
            />
            <Metric
              label="Last run status"
              value={stats.lastCheck?.ok ? "Healthy" : "Needs attention"}
            />
          </div>
        </section>

        <section className="rounded-lg border border-[#d9dfd2] bg-white/85 shadow-[0_20px_50px_-30px_rgba(32,35,29,0.35)]">
          <div className="border-b border-[#d9dfd2] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Recent matches
                </h2>
                <p className="mt-1 text-sm text-[#667161]">
                  Last 20 matched vehicles stored in Redis.
                </p>
              </div>
              <span className="rounded-full border border-[#d9dfd2] bg-[#eef2ea] px-3 py-1 text-sm font-medium text-[#2f6f52]">
                {recent.length} visible
              </span>
            </div>
          </div>

          {recent.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-[#e3e8dc]">
              {recent.map((vehicle) => (
                <VehicleRow key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

async function loadDashboardState(): Promise<
  | { ok: true; stats: DashboardStats; recent: AuctionVehicle[] }
  | { ok: false; error: string }
> {
  try {
    loadEnv();
    const [stats, recent] = await Promise.all([getStats(), getRecent(20)]);

    return { ok: true, stats, recent };
  } catch (error) {
    return { ok: false, error: getEnvValidationMessage(error) };
  }
}

function ConfigurationError({ message }: { message: string }) {
  return (
    <main className="min-h-[100dvh] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl rounded-lg border border-[#d9dfd2] bg-white p-6 shadow-[0_20px_50px_-30px_rgba(32,35,29,0.35)]">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f52]">
          Configuration
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Environment setup needed
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#667161]">{message}</p>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d9dfd2] bg-white/75 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667161]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function VehicleRow({ vehicle }: { vehicle: AuctionVehicle }) {
  return (
    <article className="grid gap-4 px-5 py-4 transition-colors hover:bg-[#f7f8f5] sm:grid-cols-[6rem_1fr_auto] sm:px-6">
      <div className="h-20 overflow-hidden rounded-md border border-[#d9dfd2] bg-[#eef2ea]">
        {vehicle.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.imageUrl}
            alt={vehicle.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-[0.12em] text-[#667161]">
            {vehicle.source}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#eef2ea] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#2f6f52]">
            {vehicle.source}
          </span>
          <span className="text-sm text-[#667161]">
            {vehicle.lotNumber ?? vehicle.stockNumber ?? vehicle.vin ?? "No ID"}
          </span>
        </div>
        <h3 className="mt-2 truncate text-base font-semibold tracking-tight">
          {vehicle.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#667161]">
          {[vehicle.location, vehicle.damage, vehicle.odometer]
            .filter(Boolean)
            .join(" | ") || "Auction details not provided"}
        </p>
      </div>

      <a
        href={vehicle.url}
        target="_blank"
        rel="noreferrer"
        className="self-center rounded-md bg-[#2f6f52] px-4 py-2 text-sm font-semibold text-white transition-transform active:translate-y-[1px]"
      >
        Open
      </a>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-lg font-semibold tracking-tight">No matches stored yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667161]">
        Run the cron endpoint once to populate Redis. The first run marks current
        listings as seen unless first-run notifications are enabled.
      </p>
    </div>
  );
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
