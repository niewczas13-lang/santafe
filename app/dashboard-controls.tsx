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
    message: "Calligraphy, hybryda i wnętrze nie-czarne są ustawione jako domyślne.",
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
    setState({ type: "loading", message: "Sprawdzam aukcje..." });
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
      error?: string;
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
      message: `Sprawdzone. Dopasowane: ${payload.totalFound ?? 0}, nowe: ${
        payload.newFound ?? 0
      }.`,
    });
    router.refresh();
  }

  return (
    <form
      onSubmit={saveFilters}
      className="rounded-lg border border-[#d9dfd2] bg-white/80 p-4 shadow-[0_20px_45px_-35px_rgba(32,35,29,0.35)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Filtry aukcji
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#667161]">
            Szukamy Calligraphy 1.6 hybrid, bez czarnego wnętrza. Limit skanu:
            200 wyników na źródło.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshNow}
          disabled={state.type === "loading"}
          className="rounded-md bg-[#2f6f52] px-4 py-2 text-sm font-semibold text-white transition-transform disabled:cursor-wait disabled:opacity-60 active:translate-y-[1px]"
        >
          Sprawdź teraz
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Kolor auta opcjonalnie"
            value={filters.exteriorColor ?? ""}
            onChange={(value) =>
              setFilters((current) => ({ ...current, exteriorColor: value }))
            }
            placeholder="np. gray, black, white"
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
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div className="rounded-md border border-[#d9dfd2] bg-[#fbfcfa] px-3 py-2 text-sm text-[#667161]">
            <span className="font-semibold text-[#20231d]">Calligraphy:</span>{" "}
            zawsze wymagane
          </div>
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

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667161]">
            Status auta
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {RUN_STATUS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 rounded-md border border-[#d9dfd2] bg-[#fbfcfa] px-3 py-2 text-sm font-medium text-[#20231d]"
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
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={state.type === "loading"}
          className="rounded-md border border-[#2f6f52] bg-white px-4 py-2 text-sm font-semibold text-[#2f6f52] transition-transform disabled:cursor-wait disabled:opacity-60 active:translate-y-[1px]"
        >
          Zapisz filtry
        </button>
        <p
          className={`text-sm ${
            state.type === "error" ? "text-[#a13d2d]" : "text-[#667161]"
          }`}
        >
          {state.message}
        </p>
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
  type?: "text" | "password";
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667161]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-10 rounded-md border border-[#d9dfd2] bg-white px-3 text-sm text-[#20231d] outline-none transition-colors placeholder:text-[#9ca694] focus:border-[#2f6f52]"
      />
    </label>
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
