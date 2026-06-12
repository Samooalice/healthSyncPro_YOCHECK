"use client";

// 라우트 에러 바운더리 (품질 8장) — 예외를 안전하게 표시하고 복구 옵션 제공.
import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 클라이언트 측 에러를 구조화 로그로 남김(운영에선 수집기로 전송)
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", event: "client_error", message: error.message, digest: error.digest }));
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-2xl text-red-500">⚠</div>
      <h1 className="text-xl font-bold text-ink">일시적인 문제가 발생했어요</h1>
      <p className="mt-2 text-sm text-body">잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.</p>
      {error.digest && <p className="mt-2 text-xs text-gray-400">오류 코드: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700">다시 시도</button>
        <Link href="/dashboard" className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-body transition hover:border-gray-400">대시보드로</Link>
      </div>
    </main>
  );
}
