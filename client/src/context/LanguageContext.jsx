import { createContext, useContext, useMemo, useState } from "react";

const words = {
  en: { dashboard: "Dashboard", inward: "Inward", stock: "Stock", reports: "Reports", logout: "Logout", language: "Language", privacy: "Privacy Policy" },
  ta: { dashboard: "முகப்பு", inward: "உள்வரவு", stock: "இருப்பு", reports: "அறிக்கைகள்", logout: "வெளியேறு", language: "மொழி", privacy: "தனியுரிமைக் கொள்கை" },
};
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(localStorage.getItem("accessories_language") || "en");
  const setLanguage = (value) => { localStorage.setItem("accessories_language", value); setLanguageState(value); };
  const value = useMemo(() => ({ language, setLanguage, t: (key) => words[language]?.[key] || key }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
