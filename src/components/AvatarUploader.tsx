// src/components/AvatarUploader.tsx
"use client";

import React from "react";
import AvatarImg from "./AvatarImg";

const TARGET = 256;           // çıktının piksel boyutu (kare)
const MAX_BYTES = 30 * 1024;  // ~30KB hedef

type Props = {
  initialUrl: string | null;
  onChanged?: (publicUrl: string | null) => void;
};

export default function AvatarUploader({ initialUrl, onChanged }: Props) {
  const [imgFile, setImgFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(initialUrl);
  const [dragging, setDragging] = React.useState(false);

  // Feedback state
  const [msg, setMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Crop state
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1.2); // zoom
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const startRef = React.useRef<{ x: number; y: number } | null>(null);

  // Image dimensions for clamping
  const [imgDim, setImgDim] = React.useState<{ w: number; h: number } | null>(null);

  // Auto-dismiss feedback
  React.useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [msg]);

  // Reset on new initialUrl
  React.useEffect(() => {
    setPreviewUrl(initialUrl);
    setOffset({ x: 0, y: 0 });
    setScale(1.2);
  }, [initialUrl]);

  // Helper: Clamp offset to keep image covering the box
  function clampOffset(x: number, y: number, s: number, dim: { w: number; h: number }) {
    // Container size
    const C = 256;
    // Calculate display dimensions
    const baseScale = Math.max(C / dim.w, C / dim.h);
    const dw = dim.w * baseScale * s;
    const dh = dim.h * baseScale * s;

    // visible overflow on each side
    // Limits: |x| <= (dw - C) / 2
    const maxUx = Math.max(0, (dw - C) / 2);
    const maxUy = Math.max(0, (dh - C) / 2);

    return {
      x: Math.max(-maxUx, Math.min(maxUx, x)),
      y: Math.max(-maxUy, Math.min(maxUy, y)),
    };
  }

  // Handle wheel non-passive to prevent scroll
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    function onWheelArg(e: WheelEvent) {
      if (!imgDim) return;
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY * -0.001;
      setScale((prevScale) => {
        const next = Math.min(3, Math.max(1, prevScale + delta));
        // We also need to re-clamp offset if we zoom out
        setOffset((prevOff) => clampOffset(prevOff.x, prevOff.y, next, imgDim));
        return next;
      });
    }

    el.addEventListener("wheel", onWheelArg, { passive: false });
    return () => el.removeEventListener("wheel", onWheelArg);
  }, [imgDim, previewUrl]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImgFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setOffset({ x: 0, y: 0 });
    setScale(1.2);
    setMsg(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setImgFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setOffset({ x: 0, y: 0 });
    setScale(1.2);
    setMsg(null);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!boxRef.current || !imgDim) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current || !imgDim) return;
    const rawX = e.clientX - startRef.current.x;
    const rawY = e.clientY - startRef.current.y;

    // Apply clamp immediately
    setOffset(clampOffset(rawX, rawY, scale, imgDim));
  }

  function onPointerUp() {
    startRef.current = null;
  }

  async function toWebPBlob(img: HTMLImageElement) {
    const size = TARGET;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const baseScale = Math.max(size / iw, size / ih);
    const s = baseScale * scale;

    const dx = (size - iw * s) / 2 + offset.x;
    const dy = (size - ih * s) / 2 + offset.y;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, dx, dy, iw * s, ih * s);

    let q = 0.9;
    for (let i = 0; i < 6; i++) {
      const b = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob), "image/webp", q)
      );
      if (b && b.size <= MAX_BYTES) return b;
      q -= 0.15;
    }
    const last = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/webp", 0.5)
    );
    if (!last) throw new Error("Failed to create WebP");
    return last;
  }

  async function handleSave() {
    try {
      if (!previewUrl) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = previewUrl;
      await img.decode();

      // Recalculate clamp for safety before saving
      const dim = { w: img.naturalWidth, h: img.naturalHeight };
      // const safeOff = clampOffset(offset.x, offset.y, scale, dim);

      const blob = await toWebPBlob(img);
      const form = new FormData();
      form.append("file", new File([blob], "avatar.webp", { type: "image/webp" }));

      const r = await fetch("/api/avatar", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) {
        setMsg({ type: "error", text: j?.error || "Upload failed" });
        return;
      }
      setImgFile(null);
      setPreviewUrl(j.publicUrl || null);
      onChanged?.(j.publicUrl || null);
      setMsg({ type: "success", text: "Avatar updated successfully!" });
    } catch (e) {
      console.error(e);
      setMsg({ type: "error", text: "Failed to save avatar." });
    }
  }

  async function handleReset() {
    try {
      const r = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg({ type: "error", text: j?.error || "Reset failed" });
        return;
      }
      setImgFile(null);
      setPreviewUrl(j.publicUrl || null);
      onChanged?.(j.publicUrl || null);
      setMsg({ type: "success", text: "Avatar reset successfully!" });
    } catch {
      setMsg({ type: "error", text: "Failed to reset avatar." });
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-start gap-5">
        <div className="shrink-0 w-24 h-24 rounded-full overflow-hidden border border-border">
          <AvatarImg src={previewUrl} size={96} />
        </div>

        <div className="space-y-3">
          <div
            ref={boxRef}
            className={[
              "relative w-64 h-64 rounded-full border border-border overflow-hidden touch-none shadow-sm",
              dragging ? "ring-4 ring-primary/20" : "",
              !previewUrl ? "bg-accent/20" : "bg-black",
              "cursor-move"
            ].join(" ")}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Preview"
                className="select-none pointer-events-none"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                  willChange: "transform",
                }}
                draggable={false}
                crossOrigin="anonymous"
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setImgDim({ w: el.naturalWidth, h: el.naturalHeight });
                  setOffset({ x: 0, y: 0 });
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm opacity-70 pointer-events-none">
                Drag & drop or choose a picture
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 z-10 border-2 border-transparent" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }} />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-white/30 z-20" />
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm cursor-pointer hover:bg-accent">
              <input type="file" accept="image/*" onChange={onPick} className="hidden" />
              Choose File
            </label>

            <div className="flex items-center gap-2">
              <span className="text-xs opacity-80">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={scale}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setScale(next);
                  if (imgDim) {
                    setOffset(cur => clampOffset(cur.x, cur.y, next, imgDim));
                  }
                }}
              />
            </div>

            <button
              onClick={handleReset}
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent cursor-pointer"
              title="Reset to default avatar"
            >
              Reset
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-accent cursor-pointer"
            >
              Save
            </button>
            {msg && (
              <div
                className={`text-sm px-2 py-1 rounded fade-in ${msg.type === "success" ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10"
                  }`}
              >
                {msg.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
