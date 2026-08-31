"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import type { Locale } from "@/i18n/config";

const USER_LINKS = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/measure", key: "measure" },
  { href: "/contents", key: "contents" },
  { href: "/care", key: "care" },
  { href: "/missions", key: "missions" },
] as const;
const PORTAL_LINKS = [
  { href: "/clinician/patients", key: "patients" },
  { href: "/admin", key: "admin" },
] as const;

// 랜딩·인증·계정선택에서는 상단 네비 숨김
const HIDE = ["/", "/login", "/signup", "/switch"];

interface Props {
  user: { name: string; role: string; impersonating: boolean } | null;
  unread?: number;
  locale: Locale;
}

export default function TopNav({ user, unread = 0, locale }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname() || "/";

  if (HIDE.includes(pathname)) {
    // 랜딩은 자체 헤더에 언어 탭을 두고 있다. 로그인·가입·계정선택에는
    // 헤더가 없으므로, 로그인 전에도 언어를 바꿀 수 있도록 떠 있는 탭만 얹는다.
    if (pathname === "/") return null;
    return (
      <div className="fixed right-4 top-4 z-50">
        <LocaleSwitcher current={locale} />
      </div>
    );
  }

  const links = user && (user.role === "clinician" || user.role === "admin") ? PORTAL_LINKS : USER_LINKS;
  const homeHref = user && (user.role === "clinician" || user.role === "admin") ? "/clinician/patients" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-cream/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href={homeHref} className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-bold text-white">W</span>
            <span className="font-bold tracking-tight text-ink">SDC WellCare</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {links.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} className="text-sm transition-colors"
                  style={{ color: active ? "var(--color-primary)" : "var(--color-body)", fontWeight: active ? 700 : 500 }}>
                  {t(l.key)}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <LocaleSwitcher current={locale} />
          {user ? (
            <>
              {user.impersonating && (
                <Link href="/switch" className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {t("switchAccount")}
                </Link>
              )}
              <Link href="/alerts" className="relative rounded-lg p-2 text-gray-500 transition hover:text-ink" aria-label={t("alerts")}>
                <Bell size={18} strokeWidth={1.75} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#D4691B] px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
                )}
              </Link>
              <span className="hidden text-sm text-body sm:inline">{user.name}</span>
              <form action={logout}>
                <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium text-subtle transition-colors hover:text-ink">{t("logout")}</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-body hover:text-ink">{t("login")}</Link>
          )}
        </div>
      </div>
    </header>
  );
}
