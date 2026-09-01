// 날짜·시간 서식 — 로케일별 표기 규칙을 한 곳에서 관리한다.
// 기존 코드에 흩어져 있던 toLocaleString("ko-KR", …) 하드코딩을 대체한다.
// 24시간제(hour12:false)는 ko/ja/zh 관행이고 en 은 12시간제가 자연스러우므로 언어별로 나눈다.
import { HTML_LANG, type Locale } from "./config";

function tag(locale: Locale): string {
  return HTML_LANG[locale];
}

function is12h(locale: Locale): boolean {
  return locale === "en";
}

/** 2026. 8. 31. 14:05 형태 (언어별 관행에 맞춰 자동 조정) */
export function fmtDateTime(locale: Locale, d: Date | string | number): string {
  return new Date(d).toLocaleString(tag(locale), { hour12: is12h(locale) });
}

/** 8/31 14:05 — 목록·로그처럼 좁은 자리용 축약형 */
export function fmtShortDateTime(locale: Locale, d: Date | string | number): string {
  return new Date(d).toLocaleString(tag(locale), {
    hour12: is12h(locale),
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 2026. 8. 31. */
export function fmtDate(locale: Locale, d: Date | string | number): string {
  return new Date(d).toLocaleDateString(tag(locale));
}

/** 26. 8. 31. — 차트 축·이력 표처럼 아주 좁은 자리용 */
export function fmtTinyDate(locale: Locale, d: Date | string | number): string {
  return new Date(d).toLocaleDateString(tag(locale), {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
  });
}

/** 14:05:32 */
export function fmtTime(locale: Locale, d: Date | string | number): string {
  return new Date(d).toLocaleTimeString(tag(locale), { hour12: is12h(locale) });
}
