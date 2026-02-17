import React from "react";

const CODE_MAP: Record<string, string> = {
    en: "gb",
    tr: "tr",
    ja: "jp",
    ko: "kr",
    zh: "cn",
    "zh-hk": "hk",
    it: "it",
    id: "id",
    th: "th",
    vi: "vn",
    "pt-br": "br",
    pt: "pt",
    de: "de",
    pl: "pl",
    es: "es",
    fr: "fr",
    ru: "ru",
    "es-la": "mx", // Mexican
    ar: "sa", // Saudi Arabia
    hi: "in", // India
};

export function FlagIcon({ lang, className }: { lang: string; className?: string }) {
    const code = CODE_MAP[lang.toLowerCase()] || lang.toLowerCase();
    const src = `https://flagcdn.com/w160/${code}.png`;

    return (
        <div className={`relative overflow-hidden ${className}`}>
            <img
                src={src}
                alt={lang}
                className="w-full h-full object-cover"
                loading="lazy"
            />
        </div>
    );
}
