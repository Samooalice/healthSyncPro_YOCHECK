"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { logout } from "@/lib/auth/actions";

const USER_LINKS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/measure", label: "측정" },
  { href: "/contents", label: "콘텐츠" },
  { href: "/care", label: "케어" },
  { href: "/missions", label: "미션" },
];
const PORTAL_LINKS = [
  { href: "/clinician/patients", label: "환자 목록" },
  { href: "/admin", label: "관리자" },
];

// 랜딩·인증·계정선택에서는 상단 네비 숨김
const HIDE = ["/", "/login", "/signup", "/switch"];

interface Props {
  user: { name: string; role: string; impersonating: boolean } | null;
  unread?: number;
}

export default function TopNav({ user, unread = 0 }: Props) {
  const pathname = usePathname() || "/";
  if (HIDE.includes(pathname)) return null;

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
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {user.impersonating && (
                <Link href="/switch" className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  계정 전환
                </Link>
              )}
              <Link href="/alerts" className="relative rounded-lg p-2 text-gray-500 transition hover:text-ink" aria-label="알림">
                <Bell size={18} strokeWidth={1.75} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#D4691B] px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
                )}
              </Link>
              <span className="hidden text-sm text-body sm:inline">{user.name}</span>
              <form action={logout}>
                <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium text-subtle transition-colors hover:text-ink">로그아웃</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-body hover:text-ink">로그인</Link>
          )}
        </div>
      </div>
    </header>
  );
}
