import { TRANSLATIONS, type Language } from "./translations";

export type { Language };

export const LANGUAGES: ReadonlyArray<{ code: Language; label: string }> = [
  { code: "en", label: "EN" },
  { code: "zh", label: "ZH" },
  { code: "ja", label: "JA" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
  { code: "de", label: "DE" },
];

const LANGUAGE_CODES = new Set<Language>(LANGUAGES.map(({ code }) => code));

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && LANGUAGE_CODES.has(value as Language);
}

export function detectLanguage(value = navigator.language): Language {
  const base = value.toLowerCase().split("-")[0];
  return isLanguage(base) ? base : "en";
}

/**
 * A key, and whatever has to be dropped into it. Missing keys come back as
 * themselves rather than as an empty line: a visible key is plainly a bug,
 * while a blank row can look like missing data.
 */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function translator(language: Language): Translate {
  const dict = TRANSLATIONS[language] ?? TRANSLATIONS.en;
  return (key, vars) => {
    const template = (dict as Record<string, string>)[key] ?? TRANSLATIONS.en[key as keyof typeof TRANSLATIONS.en] ?? key;
    if (!vars) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
      name in vars ? String(vars[name]) : whole,
    );
  };
}

/** The words for a WMO weather code, by the table lo keys them under. */
export function weatherLabelKey(code: number | null | undefined): string {
  return code != null && `weatherCode.${code}` in TRANSLATIONS.en
    ? `weatherCode.${code}`
    : "weatherCode.unknown";
}

/** The locale tag used by Intl for each supported language. */
export function localeFor(language: Language): string {
  return {
    en: "en-US",
    zh: "zh-CN",
    ja: "ja-JP",
    fr: "fr-FR",
    es: "es-ES",
    de: "de-DE",
  }[language];
}
