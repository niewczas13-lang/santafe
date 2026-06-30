"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { AuctionFilters, VehicleRunStatus } from "@/lib/types";

const RUN_STATUS_OPTIONS: Array<{ value: VehicleRunStatus; label: string }> = [
  { value: "run_and_drive", label: "Odpala i rusza" },
  { value: "starts", label: "Odpala" },
  { value: "stationary", label: "Nie odpala / stoi" },
  { value: "unknown", label: "Brak info" },
];

type ActionState =
  | { type: "idle"; message: string }
  | { type: "loading"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function DashboardControls({
  initialFilters,
}: {
  initialFilters: AuctionFilters;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [state, setState] = useState<ActionState>({
    type: "idle",
    message: "Calligraphy, hybryda i jasna tapicerka są ustawione domyślnie.",
  });

  const selectedStatusLabels = useMemo(
    () =>
      RUN_STATUS_OPTIONS.filter((option) =>
        filters.runStatuses.includes(option.value),
      )
        .map((option) => option.label)
        .join(", "),
    [filters.runStatuses],
  );

  async function saveFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setState({ type: "loading", message: "Zapisuję filtry..." });

    const payload = await saveCurrentFilters(filters);

    if (!payload.ok || !payload.filters) {
      setState({
        type: "error",
        message: payload.error ?? "Nie udało się zapisać filtrów.",
      });
      return;
    }

    setFilters(payload.filters);
    setState({ type: "success", message: "Filtry zapisane w Redis." });
    router.refresh();
  }

  async function refreshNow() {
    setState({ type: "loading", message: "Kolejkuję lokalne sprawdzenie..." });
    const saved = await saveCurrentFilters(filters);

    if (!saved.ok || !saved.filters) {
      setState({
        type: "error",
        message: saved.error ?? "Nie udało się zapisać filtrów.",
      });
      return;
    }

    setFilters(saved.filters);

    const response = await fetch("/api/dashboard/check-auctions", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const payload = (await response.json()) as {
      ok: boolean;
      queued?: boolean;
      error?: string;
      request?: { id: string };
      totalFound?: number;
      newFound?: number;
    };

    if (!response.ok || !payload.ok) {
      setState({
        type: "error",
        message: payload.error ?? "Sprawdzenie aukcji zwróciło błąd.",
      });
      return;
    }

    setState({
      type: "success",
      message: payload.queued
        ? "Zlecone. Lokalny listener na Twoim komputerze odpali skan za chwilę."
        : `Sprawdzone. Dopasowane: ${payload.totalFound ?? 0}, nowe: ${
            payload.newFound ?? 0
          }.`,
    });
    router.refresh();
  }

  return (
    <form
      onSubmit={saveFilters}
      className="overflow-hidden rounded-lg border border-[#d9dfd2] bg-white/90 shadow-[0_22px_50px_-35px_rgba(32,35,29,0.35)]"
    >
      <div className="border-b border-[#e3e8dc] bg-[#fbfcfa] px-4 py-4">
        <div className="flex flex-col gap-4 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6f52]">
              Filtry aukcji
            </p>
            <h2 className="mt-2 text-xl font-semibold leading-tight tracking-tight">
              Santa Fe Calligraphy
            </h2>
            <p className="mt-2 max-w-[36rem] text-sm leading-6 text-[#667161]">
              Szukamy 1.6 hybrid, bez czarnej tapicerki. Limit skanu: 200 aut
              na źródło.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshNow}
            disabled={state.type === "loading"}
            className="min-h-11 rounded-md bg-[#2f6f52] px-4 text-sm font-semibold text-white transition-transform hover:bg-[#285f47] disabled:cursor-wait disabled:opacity-60 active:translate-y-[1px]"
          >
            Sprawdź teraz
          </button>
        </div>

        <div className="mt-4 grid gap-2 min-[520px]:grid-cols-2">
          <FilterBadge label="Trim" value="Calligraphy wymagane" />
          <FilterBadge label="Silnik" value="Hybrid / max 2.0L" />
          <FilterBadge label="Tapicerka" value="bez czarnej" />
          <FilterBadge label="Status" value={selectedStatusLabels || "wszystkie"} />
        </div>
      </div>

      <div className="grid gap-5 px-4 py-4">
        <div className="grid gap-3 min-[520px]:grid-cols-2">
          <Field
            label="Kolor auta"
            value={filters.exteriorColor ?? ""}
            onChange={(value) =>
              setFilters((current) => ({ ...current, exteriorColor: value }))
            }
            placeholder="opcjonalnie, np. white"
          />
          <Field
            label="Tapicerka nie może być"
            value={filters.excludedInteriorColor ?? ""}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                excludedInteriorColor: value,
              }))
            }
            placeholder="black"
          />
          <Field
            label="Silnik"
            value={filters.engine ?? ""}
            onChange={(value) =>
              setFilters((current) => ({ ...current, engine: value }))
            }
            placeholder="hybrid"
          />
          <Field
            label="Max litry"
            value={String(filters.maxEngineLiters ?? 2)}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                maxEngineLiters: Number.parseFloat(value) || 2,
              }))
            }
            placeholder="2"
          />
        </div>

        <div className="grid gap-3 min-[520px]:grid-cols-2">
          <Field
            label="Aukcja od"
            type="date"
            value={filters.auctionDateFrom ?? ""}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                auctionDateFrom: value,
              }))
            }
          />
          <Field
            label="Aukcja do"
            type="date"
            value={filters.auctionDateTo ?? ""}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                auctionDateTo: value,
              }))
            }
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#667161]">
            Status auta
          </p>
          <div className="mt-2 grid gap-2 min-[520px]:grid-cols-2">
            {RUN_STATUS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex min-h-10 items-center gap-2 rounded-md border border-[#d9dfd2] bg-[#fbfcfa] px-3 py-2 text-sm font-medium text-[#20231d] transition-colors hover:border-[#b9c5b1]"
              >
                <input
                  type="checkbox"
                  checked={filters.runStatuses.includes(option.value)}
                  onChange={() =>
                    setFilters((current) => ({
                      ...current,
                      runStatuses: toggleRunStatus(
                        current.runStatuses,
                        option.value,
                      ),
                    }))
                  }
                  className="size-4 accent-[#2f6f52]"
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-[#667161]">
            Aktywne: {selectedStatusLabels || "wszystkie po zapisaniu"}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e3e8dc] pt-4 min-[520px]:flex-row min-[520px]:items-center">
          <button
            type="submit"
            disabled={state.type === "loading"}
            className="min-h-10 rounded-md border border-[#2f6f52] bg-white px-4 text-sm font-semibold text-[#2f6f52] transition-transform hover:bg-[#f3f7f1] disabled:cursor-wait disabled:opacity-60 active:translate-y-[1px]"
          >
            Zapisz filtry
          </button>
          <p
            className={`rounded-md px-3 py-2 text-sm leading-5 ${
              state.type === "error"
                ? "bg-[#fff5f1] text-[#a13d2d]"
                : state.type === "success"
                  ? "bg-[#eef7ef] text-[#2f6f52]"
                  : "bg-[#fbfcfa] text-[#667161]"
            }`}
          >
            {state.message}
          </p>
        </div>
      </div>
    </form>
  );
}

async function saveCurrentFilters(filters: AuctionFilters) {
  const response = await fetch("/api/settings/filters", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filters }),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    filters?: AuctionFilters;
  };

  return response.ok ? payload : { ...payload, ok: false };
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password" | "date";
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="min-h-4 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-[#667161]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-md border border-[#d9dfd2] bg-white px-3 text-sm text-[#20231d] outline-none transition-colors placeholder:text-[#9ca694] focus:border-[#2f6f52]"
      />
    </label>
  );
}

function FilterBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[#e3e8dc] bg-white px-3 py-2">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#667161]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-[#20231d]">
        {value}
      </p>
    </div>
  );
}

function toggleRunStatus(
  values: VehicleRunStatus[],
  value: VehicleRunStatus,
): VehicleRunStatus[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }

  return [...values, value];
}
