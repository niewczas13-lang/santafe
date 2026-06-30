import { getEnvValidationMessage, loadEnv } from "@/lib/env";
import { DashboardControls } from "./dashboard-controls";
import {
  buildDashboardSections,
  selectDashboardVehicles,
  type DashboardSections,
} from "@/lib/dashboard-list";
import { parseAuctionDate } from "@/lib/auction-date";
import { getVehicleImageUrl } from "@/lib/image-url";
import {
  getAuctionFilters,
  getRecent,
  getStats,
  getWatchedIds,
} from "@/lib/storage";
import type { AuctionFilters, AuctionVehicle, DashboardStats } from "@/lib/types";
import { WatchButton } from "./watch-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const state = await loadDashboardState();

  if (!state.ok) {
    return <ConfigurationError message={state.error} />;
  }

  const { stats, sections, filters, totalVisible } = state;

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

          <DashboardControls initialFilters={filters} />
        </section>

        <section className="rounded-lg border border-[#d9dfd2] bg-white/85 shadow-[0_20px_50px_-30px_rgba(32,35,29,0.35)]">
          <div className="border-b border-[#d9dfd2] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Auction board</h2>
                <p className="mt-1 text-sm text-[#667161]">
                  Sorted by watched status and auction date.
                </p>
              </div>
              <span className="rounded-full border border-[#d9dfd2] bg-[#eef2ea] px-3 py-1 text-sm font-medium text-[#2f6f52]">
                {totalVisible} stored
              </span>
            </div>
          </div>

          {totalVisible === 0 ? (
            <EmptyState />
          ) : (
            <div>
              <VehicleSection
                title="Obserwowane"
                description="Auta oznaczone gwiazdką."
                vehicles={sections.watched}
                watchedIds={new Set(sections.watched.map((vehicle) => vehicle.id))}
                hideWhenEmpty
              />
              <VehicleSection
                title="Aukcje z datą"
                description="Najbliższe terminy aukcji są najwyżej."
                vehicles={sections.scheduled}
                watchedIds={new Set()}
              />
              <VehicleSection
                title="Bez daty aukcji"
                description="Warto obserwować, bo termin może dojść później."
                vehicles={sections.unscheduled}
                watchedIds={new Set()}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

async function loadDashboardState(): Promise<
  | {
      ok: true;
      stats: DashboardStats;
      sections: DashboardSections;
      totalVisible: number;
      filters: AuctionFilters;
    }
  | { ok: false; error: string }
> {
  try {
    loadEnv();
    const [stats, recent, filters, watchedIds] = await Promise.all([
      getStats(),
      getRecent(),
      getAuctionFilters(),
      getWatchedIds(),
    ]);
    const visibleRecent = selectDashboardVehicles(recent, watchedIds, filters);
    const sections = buildDashboardSections(visibleRecent, watchedIds);

    return {
      ok: true,
      stats,
      sections,
      totalVisible: visibleRecent.length,
      filters,
    };
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

function VehicleSection({
  title,
  description,
  vehicles,
  watchedIds,
  hideWhenEmpty = false,
}: {
  title: string;
  description: string;
  vehicles: AuctionVehicle[];
  watchedIds: Set<string>;
  hideWhenEmpty?: boolean;
}) {
  if (hideWhenEmpty && vehicles.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-[#e3e8dc] last:border-b-0">
      <div className="flex flex-wrap items-end justify-between gap-2 bg-[#fbfcfa] px-5 py-3 sm:px-6">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#667161]">{description}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667161]">
          {vehicles.length}
        </span>
      </div>
      {vehicles.length === 0 ? (
        <p className="px-5 py-5 text-sm text-[#667161] sm:px-6">
          Brak aut w tej sekcji.
        </p>
      ) : (
        <div className="divide-y divide-[#e3e8dc]">
          {vehicles.map((vehicle) => (
            <VehicleRow
              key={vehicle.id}
              vehicle={vehicle}
              isWatched={watchedIds.has(vehicle.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function VehicleRow({
  vehicle,
  isWatched,
}: {
  vehicle: AuctionVehicle;
  isWatched: boolean;
}) {
  const imageUrl = getVehicleImageUrl(vehicle);

  return (
    <article className="grid gap-4 px-5 py-4 transition-colors hover:bg-[#f7f8f5] sm:grid-cols-[8rem_1fr_auto] sm:px-6">
      <div className="h-24 overflow-hidden rounded-md border border-[#d9dfd2] bg-[#eef2ea]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
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
        <div className="mt-3 flex flex-wrap gap-2">
          <DetailPill label="Kolor" value={vehicle.exteriorColor} />
          <DetailPill label="Wnętrze" value={vehicle.interiorColor} />
          <DetailPill label="Silnik" value={vehicle.engine} />
          <DetailPill label="Status" value={formatRunStatus(vehicle.runStatus)} />
          <DetailPill label="Aukcja" value={formatAuctionDate(vehicle.saleDate)} />
        </div>
      </div>

      <div className="flex items-center gap-2 self-center sm:flex-col sm:items-end">
        <WatchButton vehicleId={vehicle.id} initialWatched={isWatched} />
        <a
          href={vehicle.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-[#2f6f52] px-4 py-2 text-sm font-semibold text-white transition-transform active:translate-y-[1px]"
        >
          Open
        </a>
      </div>
    </article>
  );
}

function DetailPill({ label, value }: { label: string; value: string | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <span className="rounded-full border border-[#d9dfd2] bg-white px-2.5 py-1 text-xs font-medium text-[#667161]">
      <span className="text-[#20231d]">{label}:</span> {value}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-lg font-semibold tracking-tight">No matches stored yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667161]">
        Użyj panelu filtrów i przycisku Sprawdź teraz. Zdjęcia aukcyjne pojawią
        się przy wynikach, jeśli Copart albo IAAI zwróci miniaturę.
      </p>
    </div>
  );
}

function formatRunStatus(value: AuctionVehicle["runStatus"]): string | undefined {
  if (value === "run_and_drive") {
    return "odpala i rusza";
  }

  if (value === "starts") {
    return "odpala";
  }

  if (value === "stationary") {
    return "nie odpala / stoi";
  }

  if (value === "unknown") {
    return "brak info";
  }

  return undefined;
}

function formatAuctionDate(value: string | undefined): string | undefined {
  const date = parseAuctionDate(value);
  if (!date) {
    return undefined;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
