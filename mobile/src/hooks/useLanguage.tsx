import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getLang, setCurrentLang, type Lang } from "@/i18n";
import { loadValue, saveValue } from "@/services/tokenStorage";

const LANGUAGE_KEY = "qrshield.lang";

interface LanguageState {
  lang: Lang;
  changeLanguage: (next: Lang) => void;
}

const LanguageContext = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getLang());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadValue(LANGUAGE_KEY)
      .then((saved) => {
        if (saved === "fr" || saved === "en") {
          setCurrentLang(saved);
          setLang(saved);
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const changeLanguage = useCallback((next: Lang) => {
    setCurrentLang(next);
    setLang(next);
    void saveValue(LANGUAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ lang, changeLanguage }), [lang, changeLanguage]);

  if (!ready) return null;
  return (
    <LanguageContext.Provider value={value}>
      {/* Remonte tout l'arbre : chaque texte déjà affiché repart dans la nouvelle langue */}
      <Fragment key={lang}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageState {
  const context = useContext(LanguageContext);
  if (context === null) throw new Error("useLanguage doit être utilisé dans LanguageProvider");
  return context;
}
