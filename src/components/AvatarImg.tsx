"use client";

import React from "react";
import { resolveAvatarUrl, avatarPlaceholderDataUrl } from "@/lib/avatar";

type Props = {
  /** storage path | full public URL | relative public path */
  src?: string | null;
  /** placeholder initial */
  nameHint?: string | null;
  alt?: string;
  /** px (width/height attributes) */
  size?: number;
  className?: string;
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  title?: string;
};

export default function AvatarImg({
  src,
  nameHint,
  alt = "avatar",
  size = 64,
  className = "",
  rounded = "full",
  title,
}: Props) {
  const placeholder = React.useMemo(
    () => avatarPlaceholderDataUrl(nameHint || undefined),
    [nameHint]
  );

  const [url, setUrl] = React.useState<string>(() => resolveAvatarUrl(src) ?? placeholder);

  // src değişirse yeniden çöz
  React.useEffect(() => {
    setUrl(resolveAvatarUrl(src) ?? placeholder);
  }, [src, placeholder]);

  const radius =
    rounded === "full" ? "rounded-full"
    : rounded === "lg" ? "rounded-lg"
    : rounded === "md" ? "rounded-md"
    : rounded === "sm" ? "rounded-sm"
    : "";

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className={`${radius} object-cover object-center ${className}`}
      loading="lazy"
      decoding="async"
      title={title}
      style={{ aspectRatio: "1 / 1" }}
      onError={() => {
        // Görsel yüklenemezse (404 vs.) placeholder'a düş
        setUrl(placeholder);
      }}
    />
  );
}
