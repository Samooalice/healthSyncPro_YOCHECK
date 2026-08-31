"use server";

// 로케일 읽기/쓰기 — 쿠키 기반(경로 접두사 없음).
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale, type Locale } from "./config";

/** Accept-Language 헤더에서 지원 언어를 최선 매칭한다(쿠키가 없을 때만). */
async function fromAcceptLanguage(): Promise<Locale | null> {
  const h = await headers();
  const raw = h.get("accept-language");
  if (!raw) return null;
  const wanted = raw
    .split(",")
    .map((p) => {
      const [tag, ...params] = p.trim().split(";");
      const q = params.find((s) => s.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of wanted) {
    // zh-cn / zh-sg → 간체, zh-tw / zh-hk / zh-mo → 번체
    if (tag.startsWith("zh")) {
      if (/\b(tw|hk|mo|hant)\b/.test(tag)) return "zh-Hant";
      return "zh-Hans";
    }
    const base = tag.split("-")[0];
    const hit = LOCALES.find((l) => l.toLowerCase() === tag || l === base);
    if (hit) return hit;
  }
  return null;
}

export async function getUserLocale(): Promise<Locale> {
  const store = await cookies();
  const c = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return (await fromAcceptLanguage()) ?? DEFAULT_LOCALE;
}

/** 언어 스위처에서 호출하는 서버 액션. */
export async function setUserLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
}
