import type { Metadata } from "next";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import TopNav from "@/components/TopNav";
import { getCurrentUser } from "@/lib/auth/session";
import { unreadCount } from "@/lib/care/notify";
import { HTML_LANG, type Locale } from "@/i18n/config";
import { pickNamespaces, CLIENT_NAMESPACES } from "@/i18n/clientMessages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();

  const u = await getCurrentUser();
  const user = u
    ? { name: u.display_name ?? u.pseudo_id, role: u.account_type, impersonating: u.impersonatedBySuper }
    : null;
  const unread = u ? await unreadCount(u.id) : 0;

  return (
    <html lang={HTML_LANG[locale]} className="h-full antialiased">
      <body className="min-h-full">
        {/* 클라이언트 컴포넌트에서 쓰는 네임스페이스만 내려보낸다(페이로드 절감). */}
        <NextIntlClientProvider
          locale={locale}
          messages={pickNamespaces(messages, CLIENT_NAMESPACES)}
        >
          <TopNav user={user} unread={unread} locale={locale} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
