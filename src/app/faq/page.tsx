// src/app/faq/page.tsx
// MakaronComiks – FAQ (polished layout with collapsibles)

export const metadata = {
  title: "FAQ – MakaronComiks",
  description:
    "Quick answers to common questions about MakaronComiks, indexing, sources, and features.",
};

export default function FAQPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-background to-muted/40">
        <div className="container mx-auto px-4 md:px-6 py-14">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wide opacity-80">
              Help Center
            </span>
            <h1 className="mt-4 text-4xl/tight md:text-5xl/tight font-bold">
              Frequently Asked Questions
            </h1>
            <p className="mt-3 text-base md:text-lg opacity-90">
              Find quick, clear answers about content sources, search indexing,
              followed updates, and more.
            </p>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-10">
          {/* Content */}
          <article className="max-w-3xl">
            {/* Quick highlights */}
            <div className="grid sm:grid-cols-3 gap-4 mb-10">
              <Highlight title="Clean Reader UI">
                Simple, fast, mobile-friendly reading experience.
              </Highlight>
              <Highlight title="Minimal Data">
                Only what’s needed for features and security.
              </Highlight>
              <Highlight title="Respectful Indexing">
                Some titles may be de-indexed to reduce legal risk.
              </Highlight>
            </div>

            {/* Collapsible Q&A */}
            <FaqItem q="Why can’t I find some series on Google or other search engines?">
              To reduce legal risk and respect rights holders, certain titles
              (for example, English-licensed works or some Manhwa) may be
              excluded from public search engines or external discovery.
              You can still try on-site search to find what’s available.
            </FaqItem>

            <FaqItem q="What is MakaronComiks?">
              MakaronComiks is a clean, fast reader UI that surfaces public
              metadata and images via the MangaDex ecosystem. Our goal is to
              keep the experience modern, minimal, and safe for everyone.
            </FaqItem>

            <FaqItem q="Where do covers and chapter pages come from?">
              Covers are served from MangaDex image hosts. Chapter images in
              the reader are fetched at read time from the MangaDex At-Home
              network.
            </FaqItem>

            <FaqItem q="How does “Followed Updates” work?">
              When you follow titles, we store their IDs in a small cookie on
              your device. The homepage then shows recent chapters for those
              series. No server account is required for this feature.
            </FaqItem>

            <FaqItem q="Do you host or own the content?">
              We do not claim ownership of the content. We display publicly
              available data and images from MangaDex, following their API and
              community guidelines.
            </FaqItem>

            <FaqItem q="Do you run ads or sponsorships?">
              We currently avoid intrusive ads. If we add privacy-friendly
              sponsorships later, we’ll keep them minimal and update our pages.
            </FaqItem>

            <FaqItem q="How can I request removal of a title or report an issue?">
              Email{" "}
              <a className="underline underline-offset-4" href="mailto:support@makaroncomiks.example">
                support@makaroncomiks.example
              </a>{" "}
              with details (title, URLs, proof of rights/concern). We review
              legitimate requests promptly.
            </FaqItem>

            <FaqItem q="How do I change reading language or filter chapters?">
              On a series page, use the language and scanlation-group filters
              above the chapter list to switch to English or other languages,
              and to focus on a specific group if needed.
            </FaqItem>

            <FaqItem q="How can I contact you for general feedback?">
              For questions, feedback, or bug reports, write to{" "}
              <a className="underline underline-offset-4" href="mailto:support@makaroncomiks.example">
                support@makaroncomiks.example
              </a>.
            </FaqItem>
          </article>

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 h-fit">
            <nav className="rounded-2xl border border-border p-4">
              <div className="text-sm font-semibold mb-2">Quick links</div>
              <ul className="space-y-2 text-sm opacity-90">
                <li>
                  <a className="block rounded px-2 py-1 hover:bg-muted transition" href="#top">
                    Top
                  </a>
                </li>
                <li>
                  <a className="block rounded px-2 py-1 hover:bg-muted transition" href="/privacy">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a className="block rounded px-2 py-1 hover:bg-muted transition" href="/contact">
                    Contact
                  </a>
                </li>
              </ul>
            </nav>
          </aside>
        </div>
      </section>
    </main>
  );
}

/* ---------- Small UI helpers ---------- */
function Highlight({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm opacity-80">{children}</p>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-border p-4 mb-4">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg md:text-xl font-semibold">{q}</h2>
          <span className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full border border-border opacity-70 group-open:rotate-45 transition">
            +
          </span>
        </div>
      </summary>
      <div className="mt-3 text-base leading-7 opacity-90">{children}</div>
    </details>
  );
}
