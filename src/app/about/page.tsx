// src/app/about/page.tsx
"use client";

import { useLang } from "@/components/LanguageProvider";
import { useEffect } from "react";

const LAST_UPDATED = "September 19, 2025";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 mb-10">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-foreground/90">
        <i className="fa-solid fa-angle-right text-primary/50 text-xl" aria-hidden="true" />
        {title}
      </h2>
      <div className="text-base leading-7 opacity-80 space-y-4">
        {children}
      </div>
    </section>
  );
}

function TocItem({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <a href={href} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-foreground/70 hover:text-foreground transition-colors">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
        {label}
      </a>
    </li>
  );
}

export default function AboutPage() {
  const { t } = useLang();

  // Handle hash scroll on mount
  useEffect(() => {
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-background to-muted/40">
        <div className="container mx-auto px-4 md:px-6 py-14">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wide opacity-80 backdrop-blur-sm bg-background/50">
              {t.nav.about}
            </span>
            <h1 className="mt-4 text-4xl/tight md:text-5xl/tight font-bold bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
              {t.about.heroTitle}
            </h1>
            <p className="mt-3 text-base md:text-lg opacity-90 max-w-2xl leading-relaxed">
              {t.about.heroDesc}
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm opacity-60">
              <i className="fa-regular fa-calendar" />
              <span>Last updated: {LAST_UPDATED}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-10">
          {/* Content */}
          <article className="max-w-3xl">
            <Section id="what-is" title={t.about.whatIsTitle}>
              <p>{t.about.sections.whatIs_p1}</p>
              <p>{t.about.sections.whatIs_p2}</p>
            </Section>

            <Section id="how-it-works" title={t.about.howItWorksTitle}>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Covers & Pages:</strong> {t.about.sections.how_covers}</li>
                <li><strong>Search:</strong> {t.about.sections.how_search}</li>
                <li><strong>Follows:</strong> {t.about.sections.how_follows}</li>
              </ul>
              <div className="bg-accent/40 border border-accent rounded-lg p-4 mt-4 text-sm">
                <i className="fa-solid fa-circle-info mr-2 opacity-70" /> {t.about.sections.headsUp}
              </div>
            </Section>

            <Section id="tos" title={t.about.tosTitle}>
              <h3 className="font-semibold text-foreground mt-4">{t.about.sections.tos_age}</h3>
              <p>{t.about.sections.tos_age_desc}</p>

              <h3 className="font-semibold text-foreground mt-4">{t.about.sections.tos_guidelines}</h3>
              <p>{t.about.sections.tos_guidelines_desc}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t.about.sections.tos_spam}</li>
                <li>{t.about.sections.tos_sensitive}</li>
                <li>{t.about.sections.tos_spoilers}</li>
                <li>{t.about.sections.tos_violence}</li>
                <li>{t.about.sections.tos_misinfo}</li>
              </ul>

              <h3 className="font-semibold text-foreground mt-4">{t.about.sections.tos_report}</h3>
              <p>{t.about.sections.tos_report_desc}</p>

              <h3 className="font-semibold text-foreground mt-4">{t.about.sections.tos_liability}</h3>
              <p>{t.about.sections.tos_liability_desc}</p>

              <h3 className="font-semibold text-foreground mt-4">{t.about.sections.tos_changes}</h3>
              <p>{t.about.sections.tos_changes_desc}</p>
            </Section>

            <Section id="privacy" title={t.about.privacyTitle}>
              <ul className="space-y-2">
                <li className="flex gap-2">
                  <i className="fa-solid fa-check text-green-500 mt-1" />
                  <span>{t.about.sections.privacy_collect}</span>
                </li>
                <li className="flex gap-2">
                  <i className="fa-solid fa-xmark text-red-500 mt-1" />
                  <span>{t.about.sections.privacy_nocollect}</span>
                </li>
                <li className="flex gap-2">
                  <i className="fa-solid fa-server text-blue-500 mt-1" />
                  <span>{t.about.sections.privacy_use}</span>
                </li>
              </ul>
              <p className="mt-4 border-l-2 border-primary/30 pl-3 italic opacity-80">
                {t.about.sections.privacy_age}
              </p>
            </Section>

            <Section id="account-deletion" title={t.about.sections.account_del}>
              <p>{t.about.sections.account_del_desc}</p>
            </Section>

            <Section id="contact" title={t.about.contactTitle}>
              <p>{t.about.sections.contact_desc}</p>
            </Section>
          </article>

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 h-fit hidden lg:block">
            <nav className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider opacity-50 mb-3 px-2">On this page</div>
              <ul className="space-y-1 text-sm font-medium">
                <TocItem href="#what-is" label={t.about.whatIsTitle} />
                <TocItem href="#how-it-works" label={t.about.howItWorksTitle} />
                <TocItem href="#tos" label={t.about.tosTitle} />
                <TocItem href="#privacy" label={t.about.privacyTitle} />
                <TocItem href="#account-deletion" label={t.about.sections.account_del} />
                <TocItem href="#contact" label={t.about.contactTitle} />
              </ul>
            </nav>
          </aside>
        </div>
      </section>
    </main>
  );
}
