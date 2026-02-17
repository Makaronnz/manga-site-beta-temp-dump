// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LayoutChrome from "@/components/LayoutChrome";

// Font'u hem body'de (okuma), hem de html'de değişken olarak (deterministik) kullanalım
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "MakaronComiks",
  description: "MakaronComiks — read fresh chapters from MangaDex in a clean UI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Buradaki suppressHydrationWarning, tarayıcı eklentileri/tema sınıfı gibi
    // dış kaynaklı class farklarını güvenle yutar.
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      {/* inter.className SSR ve client'ta deterministik; html class farkları ise yukarıda bastırılıyor */}
      <body className={inter.className}>
        <LayoutChrome>{children}</LayoutChrome>
      </body>
    </html>
  );
}
