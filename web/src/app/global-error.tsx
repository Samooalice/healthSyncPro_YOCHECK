"use client";

// 전역 에러 바운더리 (품질) — 루트 레이아웃 자체에서 발생한 예외 처리. 자체 <html>/<body> 필요.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, color: "#1a2330" }}>서비스에 일시적인 문제가 발생했어요</h1>
          <p style={{ color: "#5b6675", fontSize: 14 }}>잠시 후 다시 시도해 주세요.</p>
          {error.digest && <p style={{ color: "#9aa3af", fontSize: 12 }}>오류 코드: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 16, background: "#2E5A88", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}>다시 시도</button>
        </div>
      </body>
    </html>
  );
}
