// GET /api/health — 헬스체크(관측성 8장). DB·ML 서비스 연결성과 지연을 점검.
// 민감정보 노출 없음. 로드밸런서·업타임 모니터·관리자 콘솔에서 사용.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function check(fn: () => Promise<void>): Promise<{ status: "up" | "down"; ms: number; error?: string }> {
  const start = performance.now();
  try {
    await fn();
    return { status: "up", ms: Math.round(performance.now() - start) };
  } catch (e) {
    return { status: "down", ms: Math.round(performance.now() - start), error: (e as Error).message };
  }
}

export async function GET() {
  const mlUrl = process.env.ML_SERVICE_URL;
  const [db, ml] = await Promise.all([
    check(async () => { await prisma.$queryRaw`SELECT 1`; }),
    check(async () => {
      // i18n:skip-start — 기계용 헬스 응답의 내부 오류 문자열(사용자 노출 아님)
      if (!mlUrl) throw new Error("ML_SERVICE_URL 미설정");
      // i18n:skip-end
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      try {
        const r = await fetch(`${mlUrl}/health`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } finally { clearTimeout(t); }
    }),
  ]);

  // DB는 핵심 의존성 → down이면 503. ML은 폴백(룰엔진)이 있어 degraded로만 표기.
  const healthy = db.status === "up";
  const overall = !healthy ? "unhealthy" : ml.status === "up" ? "healthy" : "degraded";
  return NextResponse.json(
    { status: overall, version: process.env.npm_package_version ?? "0.1.0", checks: { db, ml } },
    { status: healthy ? 200 : 503 },
  );
}
