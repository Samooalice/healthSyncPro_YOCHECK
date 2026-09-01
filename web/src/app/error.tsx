"use client";

// 라우트 에러 바운더리 (품질 8장) — 예외를 안전하게 표시하고 복구 옵션 제공.
import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    // 클라이언트 측 에러를 구조화 로그로 남김(운영에선 수집기로 전송)
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", event: "client_error", message: error.message, digest: error.digest }));
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-2xl text-red-500">⚠</div>
      <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
      <p className="mt-2 text-sm text-body">{t("lead")}</p>
      {error.digest && <p className="mt-2 text-xs text-gray-400">{t("code", { digest: error.digest })}</p>}
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700">{t("retry")}</button>
        <Link href="/dashboard" className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-body transition hover:border-gray-400">{t("toDashboard")}</Link>
      </div>
    </main>
  );
}
