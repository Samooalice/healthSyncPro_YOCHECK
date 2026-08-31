// 다국어 설정 — 기준어 ko + 번역 대상 5개 언어.
// URL 접두사 없이 쿠키(NEXT_LOCALE)로 전환한다(상단 네비 언어 탭).
// 중국어는 간체/번체를 자동 변환하지 않고 독립 카탈로그 2개로 관리한다
// (어휘 차이: 登录/登入, 保存/儲存 등).

export const LOCALES = ["ko", "en", "ja", "vi", "zh-Hans", "zh-Hant"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";

/** 언어 스위처 표기 — 각 언어의 자칭(endonym)을 쓴다. */
export const LOCALE_LABEL: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  vi: "Tiếng Việt",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
};

/** 좁은 화면용 축약 표기. */
export const LOCALE_SHORT: Record<Locale, string> = {
  ko: "KO",
  en: "EN",
  ja: "JA",
  vi: "VI",
  "zh-Hans": "简",
  "zh-Hant": "繁",
};

/** <html lang> 값 — BCP 47. */
export const HTML_LANG: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en",
  ja: "ja",
  vi: "vi",
  "zh-Hans": "zh-Hans",
  "zh-Hant": "zh-Hant",
};

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
