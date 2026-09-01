// 404 페이지 (품질) — 존재하지 않는 경로 안내.
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-5xl font-bold text-primary">404</div>
      <h1 className="text-xl font-bold text-ink">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-sm text-body">{t("notFoundLead")}</p>
      <Link href="/" className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700">{t("toHome")}</Link>
    </main>
  );
}
