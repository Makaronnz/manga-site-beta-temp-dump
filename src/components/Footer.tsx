// src/components/Footer.tsx
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border py-6 text-sm opacity-80">
      <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-center md:text-left">
          © 2025 MakaronComiks. All rights reserved.
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/about"
            className="underline underline-offset-4 hover:opacity-100 opacity-90"
            title="Learn about MakaronComiks"
          >
            About
          </Link>
          <span className="opacity-40" aria-hidden>•</span>
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:opacity-100 opacity-90"
            title="Read our Privacy Policy"
          >
            Privacy
          </Link>
          <span className="opacity-40" aria-hidden>•</span>
          <Link
            href="/faq"
            className="underline underline-offset-4 hover:opacity-100 opacity-90"
            title="Frequently Asked Questions"
          >
            FAQ
          </Link>
        </nav>
      </div>
    </footer>
  );
}
