"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { dictionaries, type Language } from "@/app/lib/dictionaries";

const LanguageContext = createContext<{
  language: Language;
  toggleLanguage: () => void;
}>({ language: "en", toggleLanguage: () => undefined });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  const toggleLanguage = () =>
    setLanguage((current) => (current === "en" ? "lo" : "en"));

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage }}>
      <div lang={language}>{children}</div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const { language, toggleLanguage } = useContext(LanguageContext);
  return { language, dictionary: dictionaries[language], toggleLanguage };
}