"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { DICT, Lang } from "@/lib/i18n";

type ContextType = {
    lang: Lang;
    t: typeof DICT["en"];
    setLang: (l: Lang) => void;
};

const LanguageContext = createContext<ContextType>({
    lang: "en",
    t: DICT.en,
    setLang: () => { },
});

export function useLang() {
    return useContext(LanguageContext);
}


function setCookie(name: string, value: string, days = 400) {
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLangState] = useState<Lang>("en");

    useEffect(() => {
        // Load preference from localStorage or HTML attribute if set
        // We can piggy-back on localStorage "language" key if we start setting it
        const stored = localStorage.getItem("mc_lang") as Lang;
        if (stored && DICT[stored]) {
            setLangState(stored);
        }
    }, []);

    function setLang(l: Lang) {
        if (!DICT[l]) return;
        setLangState(l);
        localStorage.setItem("mc_lang", l);
        setCookie("mc_lang", l);
    }

    // Listen for storage events to sync across tabs/components if updated purely locally
    useEffect(() => {
        function onStorage(e: StorageEvent) {
            if (e.key === "mc_lang" && e.newValue) {
                setLangState(e.newValue as Lang);
            }
        }
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const value = {
        lang,
        t: DICT[lang] || DICT.en,
        setLang,
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}
