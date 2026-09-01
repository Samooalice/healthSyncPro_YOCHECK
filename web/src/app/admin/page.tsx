// 관리자 콘솔 (9.5) — 운영 현황 대시보드 + 관리 영역. 위험/질환/콘텐츠 분포·최근 활동.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { GRADE_TOKEN, gradeLabel, diseaseLabel } from "@/lib/ui/labels";
import { fmtShortDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

const GRADE_ORDER = ["very_high", "high", "moderate", "low"] as const;
/** 콘텐츠 워크플로 상태 → 색상 (라벨은 contentStatus.* 카탈로그) */
const CONTENT_FLOW: [string, string][] = [
  ["draft", "#9ca3af"],
  ["medical_review", "#a6541b"],
  ["ra_review", "#6b21a8"],
  ["ready", "#2E5A88"],
  ["published", "#127a6e"],
];
/** 감사로그 액션 코드 — 라벨은 auditAction.* 카탈로그 */
const KNOWN_ACTIONS = new Set([
  "view_phi", "view_admin", "content_publish", "content_unpublish",
  "clinician_signup", "clinician_verify",
]);

function decodeName(buf: Uint8Array | null, fallback: string): string {
  if (!buf) return fallback;
  try { return Buffer.from(buf).toString("utf8"); } catch { return "—"; }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminPage() {
  await requireRole(["admin"]);
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [users, b2c, clinicians, measurements, recentMeas, assessments, samd, contents, published, rules, auditCount, pendingClin, gradeGroups, diseaseGroups, contentGroups, recentLogs] = await Promise.all([
    prisma.user_account.count(),
    prisma.user_account.count({ where: { account_type: "b2c" } }),
    prisma.user_account.count({ where: { account_type: "clinician", status: "active" } }),
    prisma.measurement.count(),
    prisma.measurement.count({ where: { measured_at: { gte: weekAgo } } }),
    prisma.risk_assessment.count(),
    prisma.risk_assessment.count({ where: { is_samd_output: true } }),
    prisma.content.count(),
    prisma.content.count({ where: { status: "published" } }),
    prisma.content_curation_rule.count({ where: { active: true } }),
    prisma.audit_log.count(),
    prisma.user_account.count({ where: { account_type: "clinician", status: "pending" } }),
    prisma.risk_assessment.groupBy({ by: ["risk_grade"], _count: { _all: true } }),
    prisma.risk_assessment.groupBy({ by: ["disease"], _count: { _all: true } }),
    prisma.content.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.audit_log.findMany({ orderBy: { occurred_at: "desc" }, take: 6 }),
  ]);

  const gradeDist: Record<string, number> = {};
  for (const r of gradeGroups) gradeDist[r.risk_grade] = r._count._all;
  const gradeTotal = Object.values(gradeDist).reduce((a, b) => a + b, 0) || 1;
  const diseaseRanked = diseaseGroups.map((d) => [d.disease, d._count._all] as [string, number]).sort((a, b) => b[1] - a[1]);
  const maxDisease = diseaseRanked[0]?.[1] ?? 1;
  const contentDist: Record<string, number> = {};
  for (const c of contentGroups) if (c.status) contentDist[c.status] = c._count._all;

  const systemActor = t("admin.system");
  const actorIds = [...new Set(recentLogs.map((l) => l.actor_id).filter((x): x is string => !!x))];
  const piis = actorIds.length ? await prisma.user_pii.findMany({ where: { user_id: { in: actorIds } } }) : [];
  const nameBy = new Map(piis.map((p) => [p.user_id, decodeName(p.name_enc as Uint8Array | null, systemActor)]));

  const stats = [
    { label: t("admin.statUsers"), value: b2c, sub: t("admin.statUsersSub", { n: users }) },
    { label: t("admin.statClinicians"), value: clinicians, sub: pendingClin > 0 ? t("admin.statPending", { n: pendingClin }) : t("admin.statApproved") },
    { label: t("nav.measure"), value: measurements, sub: t("admin.statRecent7", { n: recentMeas }) },
    { label: t("admin.statAssessments"), value: assessments, sub: t("admin.statSamd", { n: samd }) },
    { label: t("nav.contents"), value: `${published}/${contents}`, sub: t("admin.statPublishedTotal") },
    { label: t("admin.statAudit"), value: auditCount, sub: t("admin.statRules", { n: rules }) },
  ];

  const areas = [
    { key: "clinicians", desc: pendingClin > 0 ? t("admin.areaCliniciansPending", { n: pendingClin }) : t("admin.areaCliniciansDesc"), step: pendingClin > 0 ? t("admin.waiting", { n: pendingClin }) : t("admin.manage"), href: "/admin/clinicians", alert: pendingClin > 0 },
    { key: "users", desc: t("admin.areaUsersDesc"), step: t("admin.manage"), href: "/admin/users" },
    { key: "contents", desc: t("admin.areaContentsDesc"), step: t("admin.manage"), href: "/admin/contents" },
    { key: "curation", desc: t("admin.areaCurationDesc"), step: t("admin.view"), href: "/admin/curation" },
    { key: "regulatory", desc: t("admin.areaRegulatoryDesc"), step: t("admin.view"), href: "/admin/regulatory" },
    { key: "audit", desc: t("admin.areaAuditDesc"), step: t("admin.view"), href: "/admin/audit" },
    { key: "system", desc: t("admin.areaSystemDesc"), step: t("admin.view"), href: "/admin/system" },
    { key: "portal", desc: t("admin.areaPortalDesc"), step: t("admin.view"), href: "/clinician/patients" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-7 font-sans">
      <h1 className="mb-1 text-2xl font-bold text-[#2E5A88]">{t("admin.title")}</h1>
      <p className="mb-5 text-sm text-gray-500">{t("admin.subtitle")}</p>

      {/* KPI */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-400">{s.label}</div>
            <div className="num mt-1 text-xl font-bold text-[#2E5A88]">{s.value}</div>
            <div className="text-[11px] text-gray-400">{s.sub}</div>
          </div>
        ))}
      </section>

      {/* 분포 3종 */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {/* 위험등급 분포 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("portal.gradeDist")}</h2>
          <div className="flex h-3 overflow-hidden rounded-full">
            {GRADE_ORDER.map((gk) => { const n = gradeDist[gk] ?? 0; if (!n) return null; const g = GRADE_TOKEN[gk]; return <div key={gk} style={{ width: `${(n / gradeTotal) * 100}%`, background: g.color }} />; })}
          </div>
          <div className="mt-3 space-y-1 text-sm">
            {GRADE_ORDER.map((gk) => { const g = GRADE_TOKEN[gk]; return (
              <div key={gk} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} /><span className="text-gray-600">{gradeLabel(t, gk)}</span></span>
                <span className="num text-gray-700">{gradeDist[gk] ?? 0}</span>
              </div>
            ); })}
          </div>
        </section>

        {/* 질환 분포 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("admin.diseaseDist")}</h2>
          {diseaseRanked.length === 0 ? <p className="text-sm text-gray-400">{t("common.noData")}</p> : (
            <div className="space-y-2">
              {diseaseRanked.map(([d, n]) => (
                <div key={d}>
                  <div className="mb-0.5 flex justify-between text-sm"><span className="text-gray-600">{diseaseLabel(t, d)}</span><span className="num text-gray-500">{n}</span></div>
                  <div className="h-2 rounded bg-gray-100"><div className="h-2 rounded bg-[#2E5A88]" style={{ width: `${(n / maxDisease) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 콘텐츠 워크플로 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("admin.contentFlow")}</h2>
          <div className="space-y-1.5 text-sm">
            {CONTENT_FLOW.map(([k, c]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} /><span className="text-gray-600">{t(`contentStatus.${k}`)}</span></span>
                <span className="num text-gray-700">{contentDist[k] ?? 0}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 관리 영역 */}
        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">{t("admin.areas")}</h2>
          <div className="space-y-2">
            {areas.map((a) => (
              <Link key={a.key} href={a.href}>
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition hover:border-[#2E5A88]/30">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{t(`admin.area.${a.key}`)}</div>
                    <div className="text-xs text-gray-500">{a.desc}</div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[11px]" style={a.alert ? { background: "#FCEBDD", color: "#d4691b", fontWeight: 700 } : { background: "#f3f4f6", color: "#6b7280" }}>{a.step}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 최근 활동 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">{t("admin.recentActivity")}</h2>
            <Link href="/admin/audit" className="text-xs text-gray-400">{t("common.all")} →</Link>
          </div>
          <div className="space-y-1.5">
            {recentLogs.map((l) => (
              <div key={String(l.id)} className="rounded-xl border border-gray-100 bg-white p-2.5 text-xs">
                <div className="font-medium text-gray-700">{KNOWN_ACTIONS.has(l.action) ? t(`auditAction.${l.action}`) : l.action}</div>
                <div className="text-gray-400">{l.actor_id ? nameBy.get(l.actor_id) ?? "—" : systemActor} · {fmtShortDateTime(locale, l.occurred_at)}</div>
              </div>
            ))}
            {recentLogs.length === 0 && <p className="text-xs text-gray-400">{t("admin.noRecords")}</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
