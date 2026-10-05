/**
 * INGLY MOBILE - LANGUAGE CONTEXT
 * Global til holati va real-time interfeys tarjimalari
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getAppLanguage,
  setAppLanguage as setGlobalLang,
  initLanguage,
  onLanguageChange,
  t as translateHelper,
  SUPPORTED_LANGUAGES,
} from '../services/i18n.js';

const LanguageContext = createContext({
  language: 'uz',
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
  supportedLanguages: SUPPORTED_LANGUAGES,
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getAppLanguage());

  useEffect(() => {
    initLanguage().then((l) => setLanguageState(l));
    const unsub = onLanguageChange((newLang) => {
      setLanguageState(newLang);
    });
    return unsub;
  }, []);

  const changeLanguage = async (newLang) => {
    await setGlobalLang(newLang);
    setLanguageState(newLang);
  };

  const t = (key, fallback) => {
    return translateHelper(key, fallback);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: changeLanguage,
        t,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: getAppLanguage(),
      setLanguage: setGlobalLang,
      t: translateHelper,
      supportedLanguages: SUPPORTED_LANGUAGES,
    };
  }
  return context;
}
