// src/components/HeroSection.tsx
'use client';
import Image from 'next/image';
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';
import { useLang } from '@/components/LanguageProvider';

export default function HeroSection() {
  const { t } = useLang();
  return (
    // Height: 30–40vh
    <section className="relative min-h-[30vh] md:min-h-[40vh] pt-16 flex items-center">
      {/* Dark overlay to make text pop */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background/85 z-10" />

      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero.jpg"
          alt="Manga"
          fill
          priority
          className="object-cover object-top opacity-100"
        />
      </div>

      <div className="container mx-auto relative z-20 px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          {/* 'Manga Explorer' badge REMOVED */}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            {t.hero.title}
          </h1>
          <p className="opacity-80 max-w-xl">
            {t.hero.subtitle}
          </p>
          <div className="flex gap-3">
            <Link
              href="#latest"
              className={buttonClasses({ size: 'lg', className: 'rounded-full px-6' })}
            >
              {t.hero.browseLatest}
            </Link>
            <Link
              href="/browse"
              className={buttonClasses({ size: 'lg', variant: 'outline', className: 'rounded-full px-6' })}
            >
              {t.hero.allManga}
            </Link>
          </div>
        </div>
        <div className="hidden lg:block" />
      </div>
    </section>
  );
}

