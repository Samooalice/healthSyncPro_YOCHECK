"use client";

// 상단 네비 언어 전환 탭.
//
// ⚠️ 설계 원칙: **자바스크립트 없이도 동작해야 한다.**
// 언어 스위처는 화면을 읽지 못하는 사용자가 가장 먼저 눌러야 하는 컨트롤이라,
// 하이드레이션이 끝나기 전이거나 실패해도 쓸 수 있어야 한다. 그래서
//   · 목록을 <details>/<summary> 로 두어 브라우저 기본 동작으로 열고 닫고,
//   · 각 언어를 <form action={서버액션}> 으로 두어 Next 의 점진적 향상을 받는다.
// 결과적으로 6개 언어가 **서버 렌더 HTML 에 항상 들어간다**(예전 useState 드롭다운은
// 열기 전까지 DOM 에 없어서, JS 가 안 붙으면 현재 언어 하나만 보였다).
import { useEffect, useRef } from "react";
import { Globe, Check } from "lucide-react";
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT, type Locale } from "@/i18n/config";
import { setLocaleFromForm } from "@/i18n/localeActions";

export default function LocaleSwitcher({ current }: { current: Locale }) {
  const ref = useRef<HTMLDetailsElement>(null);

  // 여기부터는 "있으면 좋은" 향상 — 바깥 클릭·ESC 로 닫기.
  // JS 가 없거나 실패해도 <details> 자체는 그대로 동작한다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = () => { el.open = false; };
    const onDown = (e: MouseEvent) => {
      if (el.open && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={LOCALE_LABEL[current]}
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-body transition-colors hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        <Globe size={16} strokeWidth={1.75} />
        <span className="hidden sm:inline">{LOCALE_LABEL[current]}</span>
        <span className="sm:hidden">{LOCALE_SHORT[current]}</span>
      </summary>

      <ul className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
        {LOCALES.map((l) => (
          <li key={l}>
            <form action={setLocaleFromForm}>
              <input type="hidden" name="locale" value={l} />
              <button
                type="submit"
                lang={l}
                aria-current={l === current ? "true" : undefined}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-body transition-colors hover:bg-cream hover:text-ink"
              >
                <span className={l === current ? "font-semibold text-ink" : undefined}>
                  {LOCALE_LABEL[l]}
                </span>
                {l === current && <Check size={14} strokeWidth={2.5} className="shrink-0 text-primary" />}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </details>
  );
}
