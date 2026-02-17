// src/app/privacy/page.tsx
// MakaronComiks – Privacy Policy (polished layout)

export const metadata = {
  title: "Privacy Policy – MakaronComiks",
  description:
    "How MakaronComiks collects, uses, protects, and minimizes your data. Clear, simple, privacy-first.",
};

const LAST_UPDATED = "September 19, 2025";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-background to-muted/40">
        <div className="container mx-auto px-4 md:px-6 py-14">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wide opacity-80">
              Privacy First
            </span>
            <h1 className="mt-4 text-4xl/tight md:text-5xl/tight font-bold">
              Privacy Policy
            </h1>
            <p className="mt-3 text-base md:text-lg opacity-90">
              We collect the minimum information needed to operate MakaronComiks
              and keep your reading experience fast, simple, and safe.
            </p>
            <div className="mt-4 text-sm opacity-70">Last updated: {LAST_UPDATED}</div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-10">
          {/* Content */}
          <article className="max-w-3xl">
            {/* Highlights */}
            <div className="grid sm:grid-cols-3 gap-4 mb-10">
              <div className="rounded-2xl border border-border p-4">
                <h3 className="font-semibold">Minimal Data</h3>
                <p className="mt-1 text-sm opacity-80">
                  No newsletters. No marketing blasts. Email (if provided) is for
                  sign-in logs and security only.
                </p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <h3 className="font-semibold">Local First</h3>
                <p className="mt-1 text-sm opacity-80">
                  “Followed Updates” lives in a small cookie on your device,
                  not on our servers.
                </p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <h3 className="font-semibold">Encrypted</h3>
                <p className="mt-1 text-sm opacity-80">
                  We use HTTPS for transport security and follow a
                  data-minimization approach.
                </p>
              </div>
            </div>

            <Section id="introduction" title="Introduction">
              <p>
                Welcome to <strong>MakaronComiks</strong> (“we,” “our,” “us”). This policy
                explains what we collect, how we use it, and the choices you have.
              </p>
            </Section>

            <Section id="what-we-collect" title="What We Collect">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Email (optional):</strong> If you create an account or sign in,
                  we may store your email for authentication logs and security audits.
                  We do <em>not</em> use it for newsletters or ads.
                </li>
                <li>
                  <strong>Cookies & local state:</strong> Essential cookies support features
                  like “Followed Updates.” For example, a cookie (e.g.,{" "}
                  <code className="px-1 py-0.5 rounded bg-muted">followed</code>) can hold
                  the IDs of series you follow. This list stays on your device.
                </li>
                <li>
                  <strong>Technical logs:</strong> Standard server logs (IP, user agent,
                  request path, timestamps) used for reliability, anti-abuse, and debugging.
                </li>
              </ul>
            </Section>

            <Section id="how-we-use" title="How We Use Information">
              <ul className="list-disc pl-5 space-y-2">
                <li>Authentication, basic account integrity, and audit logging.</li>
                <li>Operating core features (e.g., followed updates, recent updates).</li>
                <li>Security, performance monitoring, and abuse prevention.</li>
              </ul>
            </Section>

            <Callout>
              We do <strong>not</strong> sell your data, and we avoid collecting anything
              we don’t genuinely need.
            </Callout>

            <Section id="cookies" title="Cookies">
              <p>
                Cookies help remember preferences and lightweight state (like your followed
                list). You can clear cookies in your browser; some features may stop working
                as intended without them.
              </p>
            </Section>

            <Section id="third-parties" title="Third-Party Services & Links">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Images / reader:</strong> Covers are served from MangaDex image
                  hosts; chapter images may be fetched at read time via the MangaDex
                  At-Home network.
                </li>
                <li>
                  <strong>External links:</strong> We may link to official publishers or
                  community resources. Their policies apply on their sites.
                </li>
              </ul>
            </Section>

            <Section id="search-indexing" title="Search Indexing & Removals">
              <p>
                To respect rights holders and community norms, some titles
                (e.g., English-licensed works) may be excluded from public search engines
                or hidden from external discovery. Legitimate takedown requests are reviewed
                promptly.
              </p>
            </Section>

            <Section id="sharing" title="Data Sharing">
              <p>
                We do not sell personal data. We may share limited information if required
                by law, to respond to lawful requests, or to protect users and our service.
              </p>
            </Section>

            <Section id="retention" title="Data Retention">
              <p>
                Logs and minimal account data are retained only as long as needed for
                operations, security, or legal obligations—then deleted or anonymized.
              </p>
            </Section>

            <Section id="security" title="Security">
              <ul className="list-disc pl-5 space-y-2">
                <li>Transport encryption (HTTPS/TLS).</li>
                <li>Data minimization by design.</li>
                <li>Internal access reviews and periodic checks.</li>
              </ul>
            </Section>

            <Section id="your-rights" title="Your Choices & Rights">
              <p>
                You can clear cookies any time in your browser. If you created an account,
                contact us to request account deletion or obtain a summary of your basic
                account data.
              </p>
            </Section>

            <Section id="changes" title="Changes to This Policy">
              <p>
                We may update this page if our practices change. Material changes will be
                highlighted at the top with a new “Last updated” date.
              </p>
            </Section>

            <Section id="contact" title="Contact">
              <p>
                Questions or removal requests? Email{" "}
                <a className="underline underline-offset-4" href="mailto:support@makaroncomiks.example">
                  support@makaroncomiks.example
                </a>.
              </p>
            </Section>
          </article>

          {/* Sidebar (On this page) */}
          <aside className="lg:sticky lg:top-24 h-fit">
            <nav className="rounded-2xl border border-border p-4">
              <div className="text-sm font-semibold mb-2">On this page</div>
              <ul className="space-y-2 text-sm opacity-90">
                <TocItem href="#introduction" label="Introduction" />
                <TocItem href="#what-we-collect" label="What We Collect" />
                <TocItem href="#how-we-use" label="How We Use Information" />
                <TocItem href="#cookies" label="Cookies" />
                <TocItem href="#third-parties" label="Third-Party Services" />
                <TocItem href="#search-indexing" label="Search Indexing" />
                <TocItem href="#sharing" label="Data Sharing" />
                <TocItem href="#retention" label="Data Retention" />
                <TocItem href="#security" label="Security" />
                <TocItem href="#your-rights" label="Your Rights" />
                <TocItem href="#changes" label="Changes" />
                <TocItem href="#contact" label="Contact" />
              </ul>
            </nav>
          </aside>
        </div>
      </section>
    </main>
  );
}

/* ---------- Small UI helpers ---------- */
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 mb-10">
      <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
      <div className="mt-3 space-y-4 text-base leading-7 opacity-90">{children}</div>
    </section>
  );
}

function TocItem({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <a
        className="block rounded px-2 py-1 hover:bg-muted transition"
        href={href}
      >
        {label}
      </a>
    </li>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-8 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
      <div className="font-semibold">Heads up</div>
      <div className="mt-1 text-sm leading-6 opacity-90">{children}</div>
    </div>
  );
}
