// src/components/ReadingProgressReporter.tsx
/**
 * INFO:
 * Fire-and-forget progress reporter for **autosave/Next** only.
 * - Use this component when you actually advance to a later chapter.
 * - Forward-only is enforced by /api/reading (server).
 */
"use client";
import { useEffect } from "react";

export default function ReadingProgressReporter({
  seriesId,
  chapterId,
  chapter,
  force = false,
}: {
  seriesId: string | number;
  chapterId: string | number;
  chapter?: string | null;
  force?: boolean;
}) {
  useEffect(() => {
    const s = String(seriesId);
    const c = String(chapterId);
    if (!s || !c) return;
    fetch("/api/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId: s, chapterId: c, chapter: chapter ?? null, force }),
    }).catch(() => {});
  }, [seriesId, chapterId, chapter, force]);

  return null;
}
