// 관리자 — 시스템 상태/관측성 (8장). 의존성 헬스·보안 이벤트·버전 정보.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function check(fn: () => Promise<void>): Promise<{ status: "up" | "down"; ms: number; error?: string }> {
  const start = performance.now();
  try { await fn(); return { status: "up", ms: Math.round(performance.now() - start) }; }
  catch (e) { return { status: "down", ms: Math.round(performance.now() - start), error: (e as Error).message }; }
}

const SEC_KO: Record<string, string> = {
  login_failed: "로그인 실패", login_blocked: "레이트리밋 차단", view_phi: "환자정보 열람", clinician_verify: "의료진 승인심사",
};

export default async function SystemPage() {
  const me = await requireRole(["admin"]);
  await audit(me.id, "view_admin", "system");

  const mlUrl = process.env.ML_SERVICE_URL;
  const dayAgo = new Date(Date.now() - 86400_000);
  const [db, ml, secEvents, loginFail24, loginBlock24, phi24, recentSec] = await Promise.all([
    check(async () => { await prisma.$queryRaw`SELECT 1`; }),
    check(async () => {
      if (!mlUrl) throw new Error("ML_SERVICE_URL 미설정");
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2000);
      try { const r = await fetch(`${mlUrl}/health`, { signal: ctrl.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); }
      finally { clearTimeout(t); }
    }),
    prisma.audit_log.groupBy({ by: ["action"], _count: { _all: true }, where: { action: { in: ["login_failed", "login_blocked", "view_phi", "clinician_verify"] } } }),
    prisma.audit_log.count({ where: { action: "login_failed", occurred_at: { gte: dayAgo } } }),
    prisma.audit_log.count({ where: { action: "login_blocked", occurred_at: { gte: dayAgo } } }),
    prisma.audit_log.count({ where: { action: "view_phi", occurred_at: { gte: dayAgo } } }),
    prisma.audit_log.findMany({ where: { action: { in: ["login_failed", "login_blocked"] } }, orderBy: { occurred_at: "desc" }, take: 8 }),
  ]);

  const overall = db.status !== "up" ? "unhealthy" : ml.status === "up" ? "healthy" : "degraded";
  const overallStyle: Record<string, { label: string; color: string; bg: string }> = {
    healthy: { label: "정상", color: "#127a6e", bg: "#E1F3EF" },
    degraded: { label: "성능저하(ML 폴백)", color: "#a6541b", bg: "#FCEBDD" },
    unhealthy: { label: "장애", color: "#b42318", bg: "#FEE4E2" },
  };
  const os = overallStyle[overall];
  const secMap: Record<string, number> = {};
  for (const e of secEvents) secMap[e.action] = e._count._all;

  const Dep = ({ name, c, note }: { name: string; c: { status: string; ms: number; error?: string }; note: string }) => (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.status === "up" ? "#127a6e" : "#b42318" }} />
          <span className="font-semibold text-gray-800">{name}</span>
        </div>
        <div className="mt-0.5 text-xs text-gray-500">{c.error ? c.error : note}</div>
      </div>
      <div className="text-right">
        <div className="num text-sm font-bold" style={{ color: c.status === "up" ? "#127a6e" : "#b42318" }}>{c.status === "up" ? "UP" : "DOWN"}</div>
        <div className="num text-[11px] text-gray-400">{c.ms}ms</div>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-7 font-sans">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E5A88]">시스템 상태</h1>
          <p className="text-sm text-gray-500">의존성 헬스·보안 이벤트·관측성</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">← 콘솔</Link>
      </header>

      {/* 종합 상태 */}
      <section className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5">
        <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ color: os.color, background: os.bg }}>● {os.label}</span>
        <span className="text-sm text-gray-600">서비스 종합 상태 · DB는 핵심 의존성, ML 장애 시 룰 엔진으로 자동 폴백</span>
      </section>

      {/* 의존성 */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2">
        <Dep name="PostgreSQL (Supabase)" c={db} note="care/secure 스키마 · 핵심 의존성" />
        <Dep name="ML 추론 서비스 (LightGBM)" c={ml} note="port 8800 · 장애 시 폴백 동작" />
      </section>

      {/* 보안 지표 (최근 24h) */}
      <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">보안 지표 (최근 24시간)</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[["로그인 실패", loginFail24, "#C79100"], ["레이트리밋 차단", loginBlock24, "#b42318"], ["PHI 열람", phi24, "#2E5A88"]].map(([l, v, c]) => (
            <div key={l as string} className="rounded-xl border border-gray-100 p-3">
              <div className="num text-2xl font-bold" style={{ color: c as string }}>{v as number}</div>
              <div className="text-xs text-gray-500">{l as string}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">누적: {Object.entries(secMap).map(([k, v]) => `${SEC_KO[k] ?? k} ${v}`).join(" · ") || "이벤트 없음"}</p>
      </section>

      {/* 최근 보안 이벤트 */}
      <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">최근 인증 보안 이벤트</h2>
          <Link href="/admin/audit" className="text-xs text-gray-400">감사로그 →</Link>
        </div>
        <div className="space-y-1.5">
          {recentSec.map((e) => (
            <div key={String(e.id)} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-xs">
              <span className="font-medium" style={{ color: e.action === "login_blocked" ? "#b42318" : "#C79100" }}>{SEC_KO[e.action] ?? e.action}</span>
              <span className="font-mono text-gray-500">{e.target ?? "—"}</span>
              <span className="text-gray-400">{new Date(e.occurred_at).toLocaleString("ko-KR", { hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
          {recentSec.length === 0 && <p className="text-xs text-gray-400">최근 인증 보안 이벤트가 없습니다.</p>}
        </div>
      </section>

      {/* 버전·런타임 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">런타임 정보</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          {[["환경", process.env.NODE_ENV ?? "—"], ["Node", process.version], ["앱 버전", process.env.npm_package_version ?? "0.1.0"], ["헬스 엔드포인트", "/api/health"]].map(([l, v]) => (
            <div key={l}><div className="text-[11px] text-gray-400">{l}</div><div className="num text-gray-700">{v}</div></div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          ※ 보안 헤더(CSP·HSTS·X-Frame-Options 등)·레이트리밋·구조화 로깅·감사로그가 적용됩니다. 운영에선 외부 로그 수집·APM·알림 연동으로 확장합니다.
        </p>
      </section>
    </main>
  );
}
