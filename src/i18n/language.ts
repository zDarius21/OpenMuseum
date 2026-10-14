/** Le lingue del sito. */
export const LANGUAGES = ['it', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Dove si ricorda la lingua scelta, per la visita successiva. */
const STORAGE_KEY = 'openmuseum.language';
/** Il parametro dell'indirizzo che sceglie la lingua, per esempio `?lang=en`: utile per condividere il link. */
const URL_PARAM = 'lang';

/** Numeri e date: le misure diventano «95,5 cm» in italiano e «95.5 cm» in inglese. */
const LOCALES: Record<Language, string> = { it: 'it-IT', en: 'en-US' };

let current: Language = initialLanguage();
const listeners = new Set<(language: Language) => void>();
document.documentElement.lang = current;

export function language(): Language {
  return current;
}

export function locale(): string {
  return LOCALES[current];
}

/** Cambia la lingua del sito, la ricorda e avvisa chi deve ridisegnare i suoi testi. */
export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  document.documentElement.lang = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Senza memoria del browser (finestra anonima, dati bloccati) la scelta vale solo per questa visita.
  }
  // Se l'indirizzo sceglie la lingua, va aggiornato: ricaricando la pagina tornerebbe quella di prima.
  const url = new URL(location.href);
  if (url.searchParams.has(URL_PARAM)) {
    url.searchParams.set(URL_PARAM, language);
    history.replaceState(history.state, '', url);
  }
  for (const listener of listeners) listener(language);
}

/** Chiama `listener` a ogni cambio di lingua. */
export function onLanguageChange(listener: (language: Language) => void): void {
  listeners.add(listener);
}

/** Prima l'indirizzo, poi la scelta della visita precedente, poi la prima tra le lingue preferite del browser che il sito ha; se no l'inglese. */
function initialLanguage(): Language {
  const fromUrl = new URL(location.href).searchParams.get(URL_PARAM);
  if (isLanguage(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Memoria del browser non disponibile: si usa la lingua del browser.
  }
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const code = tag?.slice(0, 2).toLowerCase();
    if (isLanguage(code)) return code;
  }
  return 'en';
}

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}
