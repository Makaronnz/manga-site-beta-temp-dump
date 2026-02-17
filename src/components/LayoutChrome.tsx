// src/components/LayoutChrome.tsx
"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PropsWithChildren } from "react";
import LanguageProvider from "@/components/LanguageProvider";

/**
 * Global header/footer'ı okuma rotalarında gizler.
 * - /series/[id]/chapter/[chapterId]
 * - /read/[chapterId]
 */
export default function LayoutChrome({ children }: PropsWithChildren) {
  const pathname = usePathname();
  // Fixed logic for reading pages
  const isSeriesReader = pathname?.includes("/series/") && /\/g-[a-zA-Z0-9]+-chapter-/.test(pathname || "");
  const isReader = isSeriesReader || pathname?.startsWith("/read/");

  // Apply theme from local storage
  if (typeof window !== "undefined") {
    const t = localStorage.getItem("theme");
    if (t && ["light", "dark", "grey"].includes(t)) {
      document.documentElement.classList.remove("light", "dark", "grey");
      document.documentElement.classList.add(t);
    }
  }

  return (
    <LanguageProvider>
      {!isReader && <Header />}
      <main className={isReader ? "" : "pt-16"}>{children}</main>
      {!isReader && <Footer />}
    </LanguageProvider>
  );
}
