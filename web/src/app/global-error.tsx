"use client";

// 전역 에러 바운더리 (품질) — 루트 레이아웃 자체에서 발생한 예외 처리. 자체 <html>/<body> 필요.
//
// ⚠️ 이 화면은 NextIntlClientProvider 바깥(루트 레이아웃이 죽은 상황)에서 렌더링되므로
//    useTranslations 를 쓸 수 없다. 그래서 예외적으로 문구를 인라인 사전으로 들고 있다.
//    번역 카탈로그를 고칠 때 이 파일도 같이 봐야 한다 — i18n_scan.py 가 별도로 보고한다.
import { LOCALE_COOKIE, DEFAULT_LOCALE, HTML_LANG, isLocale, type Locale } from "@/i18n/config";

const TEXT: Record<Locale, { title: string; lead: string; code: string; retry: string }> = {
  ko: {
    title: "서비스에 일시적인 문제가 발생했어요",
    lead: "잠시 후 다시 시도해 주세요.",
    code: "오류 코드",
    retry: "다시 시도",
  },
  en: {
    title: "Something went wrong on our side",
    lead: "Please try again in a moment.",
    code: "Error code",
    retry: "Try again",
  },
  ja: {
    title: "サービスに一時的な問題が発生しました",
    lead: "しばらくしてからもう一度お試しください。",
    code: "エラーコード",
    retry: "再試行",
  },
  vi: {
    title: "Đã xảy ra sự cố tạm thời với dịch vụ",
    lead: "Vui lòng thử lại sau giây lát.",
    code: "Mã lỗi",
    retry: "Thử lại",
  },
  "zh-Hans": {
    title: "服务出现临时问题",
    lead: "请稍后再试。",
    code: "错误代码",
    retry: "重试",
  },
  "zh-Hant": {
    title: "服務發生暫時性問題",
    lead: "請稍後再試。",
    code: "錯誤代碼",
    retry: "重試",
  },
};

/** 프로바이더 없이 쿠키에서 직접 로케일을 읽는다(문서 접근 실패 시 기본어). */
function readLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const m = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const v = m ? decodeURIComponent(m[1]) : null;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = readLocale();
  const t = TEXT[locale];

  return (
    <html lang={HTML_LANG[locale]}>
      <body style={{ fontFamily: "sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, color: "#1a2330" }}>{t.title}</h1>
          <p style={{ color: "#5b6675", fontSize: 14 }}>{t.lead}</p>
          {error.digest && <p style={{ color: "#9aa3af", fontSize: 12 }}>{t.code}: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 16, background: "#2E5A88", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}>{t.retry}</button>
        </div>
      </body>
    </html>
  );
}
