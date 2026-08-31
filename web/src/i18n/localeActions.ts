"use server";

// 로케일 변경 서버 액션.
//
// 언어 스위처는 "비한국어 사용자가 화면을 이해하기 전에 가장 먼저 눌러야 하는" 컨트롤이다.
// 그래서 자바스크립트가 붙기 전에도 동작해야 한다 → <form action={...}> 으로 두어
// Next 의 점진적 향상(progressive enhancement)을 그대로 받는다.
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale, type Locale } from "./config";

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  httpOnly: false,
} as const;

/** 폼 제출로 언어 변경 (JS 없이도 동작). */
export async function setLocaleFromForm(formData: FormData): Promise<void> {
  const v = String(formData.get("locale") ?? "");
  if (!isLocale(v)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, v, COOKIE_OPTS);
  // 레이아웃까지 다시 그려야 <html lang> 과 네비 문구가 함께 바뀐다.
  revalidatePath("/", "layout");
}

/** 프로그램적으로 언어 변경이 필요할 때. */
export async function setUserLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, COOKIE_OPTS);
  revalidatePath("/", "layout");
}
