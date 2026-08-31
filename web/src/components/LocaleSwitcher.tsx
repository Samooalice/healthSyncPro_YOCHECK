"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale";

/** 상단 네비 언어 전환 탭. 쿠키를 바꾸고 서버 컴포넌트를 다시 그린다. */
export default function LocaleSwitcher({ current }: { current: Locale }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(l: Locale) {
    setOpen(false);
    if (l === current) return;
    startTransition(async () => {
      await setUserLocale(l);
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={LOCALE_LABEL[current]}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-body transition-colors hover:text-ink disabled:opacity-50"
      >
        <Globe size={16} strokeWidth={1.75} />
        <span className="hidden sm:inline">{LOCALE_LABEL[current]}</span>
        <span className="sm:hidden">{LOCALE_SHORT[current]}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 min-w-[9.5rem] overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === current}
                lang={l}
                onClick={() => pick(l)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-body transition-colors hover:bg-cream hover:text-ink"
              >
                <span className={l === current ? "font-semibold text-ink" : undefined}>
                  {LOCALE_LABEL[l]}
                </span>
                {l === current && <Check size={14} strokeWidth={2.5} className="text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
