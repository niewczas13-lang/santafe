"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WatchButton({
  vehicleId,
  initialWatched,
}: {
  vehicleId: string;
  initialWatched: boolean;
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatched);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const nextWatched = !watched;
    setWatched(nextWatched);
    setSaving(true);

    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: vehicleId, watched: nextWatched }),
    });

    if (!response.ok) {
      setWatched(watched);
    } else {
      router.refresh();
    }

    setSaving(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-label={watched ? "Usuń z obserwowanych" : "Dodaj do obserwowanych"}
      title={watched ? "Obserwowane" : "Dodaj do obserwowanych"}
      className={`grid size-9 place-items-center rounded-md border text-lg leading-none transition-transform disabled:cursor-wait disabled:opacity-60 active:translate-y-[1px] ${
        watched
          ? "border-[#c9a646] bg-[#fff8da] text-[#8a6a08]"
          : "border-[#d9dfd2] bg-white text-[#667161] hover:border-[#c9a646] hover:text-[#8a6a08]"
      }`}
    >
      {watched ? "★" : "☆"}
    </button>
  );
}
