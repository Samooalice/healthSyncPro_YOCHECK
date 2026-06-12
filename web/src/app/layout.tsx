import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";
import { getCurrentUser } from "@/lib/auth/session";
import { unreadCount } from "@/lib/care/notify";

export const metadata: Metadata = {
  title: "SDC WellCare · 만성질환 관리 플랫폼",
  description: "요화학분석기 기반 만성질환 관리 통합플랫폼 — 측정·분석·이해·행동",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const u = await getCurrentUser();
  const user = u
    ? { name: u.display_name ?? u.pseudo_id, role: u.account_type, impersonating: u.impersonatedBySuper }
    : null;
  const unread = u ? await unreadCount(u.id) : 0;

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <TopNav user={user} unread={unread} />
        {children}
      </body>
    </html>
  );
}
