// 관리자 — 시스템 상태/관측성 (8장). 의존성 헬스·보안 이벤트·버전 정보.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fmtShortDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

async function check(fn: () => Promise<void>): Promise<{ status: "up" | "down"; ms: number; error?: string }> {
  const start = performance.now();
  try { await fn(); return { status: "up", ms: Math.round(performance.now() - start) }; }
  catch (e) { return { status: "down", ms: Math.round(performance.now() - start), error: (e as Error).message }; }
}

// 보안 이벤트 코드 — 표시 문구는 secEvent.* 카탈로그
const SEC_CODES = ["login_failed", "login_blocked", "view_phi", "clinician_verify"];

export default async function SystemPage() {
  const me = await requireRole(["admin"]);
  await audit(me.id, "view_admin", "system");
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const secLabel = (code: string) => (SEC_CODES.includes(code) ? t(`secEvent.${code}`) : code);

  const mlUrl = process.env.ML_SERVICE_URL;
  const dayAgo = new Date(Date.now() - 86400_000);
  const [db, ml, secEvents, loginFail24, loginBlock24, phi24, recentSec] = await Promise.all([
    check(async () => { await prisma.$queryRaw`SELECT 1`; }),
    check(async () => {
      if (!mlUrl) throw new Error(t("system.mlUrlMissing"));
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 2000);
      try { const r = await fetch(`${mlUrl}/health`, { signal: ctrl.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); }
      finally { clearTimeout(timer); }
    }),
    prisma.audit_log.groupBy({ by: ["action"], _count: { _all: true }, where: { action: { in: ["login_failed", "login_blocked", "view_phi", "clinician_verify"] } } }),
    prisma.audit_log.count({ where: { action: "login_failed", occurred_at: { gte: dayAgo } } }),
    prisma.audit_log.count({ where: { action: "login_blocked", occurred_at: { gte: dayAgo } } }),
    prisma.audit_log.count({ where: { action: "view_phi", occurred_at: { gte: dayAgo } } }),
    prisma.audit_log.findMany({ where: { action: { in: ["login_failed", "login_blocked"] } }, orderBy: { occurred_at: "desc" }, take: 8 }),
  ]);

  const overall = db.status !== "up" ? "unhealthy" : ml.status === "up" ? "healthy" : "degraded";
  const overallStyle: Record<string, { color: string; bg: string }> = {
    healthy: { color: "#127a6e", bg: "#E1F3EF" },
    degraded: { color: "#a6541b", bg: "#FCEBDD" },
    unhealthy: { color: "#b42318", bg: "#FEE4E2" },
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
          <h1 className="text-2xl font-bold text-[#2E5A88]">{t("admin.area.system")}</h1>
          <p className="text-sm text-gray-500">{t("admin.areaSystemDesc")}</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">← {t("audit.console")}</Link>
      </header>

      {/* 종합 상태 */}
      <section className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5">
        <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ color: os.color, background: os.bg }}>● {t(`system.overall.${overall}`)}</span>
        <span className="text-sm text-gray-600">{t("system.overallNote")}</span>
      </section>

      {/* 의존성 */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2">
        <Dep name="PostgreSQL (Supabase)" c={db} note={t("system.depDb")} />
        <Dep name={t("system.depMl")} c={ml} note={t("system.depMlNote")} />
      </section>

      {/* 보안 지표 (최근 24h) */}
      <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("system.secMetrics")}</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          {([[t("secEvent.login_failed"), loginFail24, "#C79100"], [t("secEvent.login_blocked"), loginBlock24, "#b42318"], [t("system.phiViews"), phi24, "#2E5A88"]] as [string, number, string][]).map(([l, v, c]) => (
            <div key={l} className="rounded-xl border border-gray-100 p-3">
              <div className="num text-2xl font-bold" style={{ color: c }}>{v}</div>
              <div className="text-xs text-gray-500">{l}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">{t("system.cumulative", { list: Object.entries(secMap).map(([k, v]) => `${secLabel(k)} ${v}`).join(" · ") || t("system.noEvents") })}</p>
      </section>

      {/* 최근 보안 이벤트 */}
      <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{t("system.recentSec")}</h2>
          <Link href="/admin/audit" className="text-xs text-gray-400">{t("admin.statAudit")} →</Link>
        </div>
        <div className="space-y-1.5">
          {recentSec.map((e) => (
            <div key={String(e.id)} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-xs">
              <span className="font-medium" style={{ color: e.action === "login_blocked" ? "#b42318" : "#C79100" }}>{secLabel(e.action)}</span>
              <span className="font-mono text-gray-500">{e.target ?? "—"}</span>
              <span className="text-gray-400">{fmtShortDateTime(locale, e.occurred_at)}</span>
            </div>
          ))}
          {recentSec.length === 0 && <p className="text-xs text-gray-400">{t("system.noRecentSec")}</p>}
        </div>
      </section>

      {/* 버전·런타임 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("system.runtime")}</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          {([[t("system.env"), process.env.NODE_ENV ?? "—"], ["Node", process.version], [t("system.appVersion"), process.env.npm_package_version ?? "0.1.0"], [t("system.healthEndpoint"), "/api/health"]] as [string, string][]).map(([l, v]) => (
            <div key={l}><div className="text-[11px] text-gray-400">{l}</div><div className="num text-gray-700">{v}</div></div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          {t("system.note")}
        </p>
      </section>
    </main>
  );
}
