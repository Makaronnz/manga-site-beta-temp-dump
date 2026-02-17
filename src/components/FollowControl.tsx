// src/components/FollowControl.tsx
"use client";

import { useEffect, useState } from "react";

type FollowStatus = "Unfollow" | "Reading" | "Completed" | "On-Hold" | "Dropped" | "Plan to Read";
const STATUS_LIST: FollowStatus[] = ["Unfollow", "Reading", "Completed", "On-Hold", "Dropped", "Plan to Read"];

export default function FollowControl({
  seriesId,     // MD UUID | slug | numeric — hepsi kabul
  title,
  coverUrl,
  className,
}: {
  seriesId: string | number;
  title: string;
  coverUrl?: string | null;
  className?: string;
}) {
  const [status, setStatus] = useState<FollowStatus>("Unfollow");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // ✅ Başlangıç durumu: DB'den oku (tek seri endpoint'i)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/follow?seriesId=${encodeURIComponent(String(seriesId))}`, { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        const s = (j?.status as FollowStatus | undefined) ?? (j?.followed ? "Reading" : "Unfollow");
        setStatus(s);
      } catch {
        if (!alive) return;
        setStatus("Unfollow");
      }
    })();
    return () => {
      alive = false;
    };
  }, [seriesId]);

  async function choose(next: FollowStatus) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,         // ✅ MD UUID/slug/numeric hepsi desteklenir
          status: next,     // backend toggle ETMEYECEK → verilen durumu set eder
          title,
          coverUrl,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Could not save follow status.");
        return;
      }

      const nextEffective: FollowStatus =
        (j?.status as FollowStatus) || (next === "Unfollow" ? "Unfollow" : "Reading");
      setStatus(nextEffective);

      // diğer sekmelere haber ver
      window.dispatchEvent(
        new CustomEvent("mc-follow-updated", {
          detail: { seriesId, status: nextEffective, title, coverUrl },
        })
      );
    } catch {
      alert("Could not save follow status.");
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  // Tek tık Follow → Reading
  const onMainClick = () => {
    if (saving) return;
    if (status === "Unfollow") {
      void choose("Reading");
    } else {
      setOpen((o) => !o);
    }
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={onMainClick}
        disabled={saving}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-accent cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <i className="fa-regular fa-bookmark" />
        <span>{status === "Unfollow" ? "Follow" : status}</span>
        <i className="fa-solid fa-chevron-down text-xs opacity-70" />
      </button>

      {open && (
        <ul
          className="absolute z-50 mt-1 min-w-[220px] rounded-md border border-border bg-background shadow-xl overflow-hidden"
          role="listbox"
          onMouseLeave={() => setOpen(false)}
        >
          {STATUS_LIST.map((it) => (
            <li key={it}>
              <button
                type="button"
                className={[
                  "w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-accent",
                  status === it ? "bg-accent/60" : "",
                ].join(" ")}
                onClick={() => choose(it)}
              >
                {it}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
