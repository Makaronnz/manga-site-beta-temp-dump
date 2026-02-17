// src/components/follow/FollowButton.tsx
"use client";

import { useEffect, useState } from "react";

export default function FollowButton({ seriesId }: { seriesId: number }) {
  const [followed, setFollowed] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/follow?seriesId=${seriesId}`);
      const j = await r.json();
      setFollowed(!!j.followed);
      setLoading(false);
    })();
  }, [seriesId]);

  const toggle = async () => {
    const r = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId }),
    });
    const j = await r.json();
    if (!r.ok) {
      alert(j.error || "You need to login first.");
      return;
    }
    setFollowed(j.followed);
  };

  return (
    <button onClick={toggle} disabled={loading} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20">
      {followed ? "Unfollow" : "Follow"}
    </button>
  );
}
