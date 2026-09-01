// 의료진 포털 — 환자 목록 + 코호트 요약 (9.4). 위험순 정렬, 가명ID·등급분포·질환분포·필터.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { GRADE_TOKEN, gradeLabel, diseaseLabel } from "@/lib/ui/labels";
import { gradeDistribution } from "@/lib/ui/clinical";
import { fmtDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

const SEVERITY: Record<string, number> = { very_high: 3, high: 2, moderate: 1, low: 0 };
// 필터 라벨은 grade.* 카탈로그를 그대로 쓴다(별도 축약 라벨을 두지 않는다 — 용어 이중관리 방지).
const GRADE_FILTERS = ["all", "very_high", "high", "moderate", "low"];
const DISEASE_FILTERS = ["all", "kidney", "diabetes", "hypertension", "uti", "liver"];
const GRADE_ORDER = ["very_high", "high", "moderate", "low"] as const;

function decodeName(buf: Uint8Array | null, fallback: string): string {
  if (!buf) return fallback;
  try { return Buffer.from(buf).toString("utf8"); } catch { return fallback; }
}

export default async function PatientListPage({ searchParams }: { searchParams: Promise<{ grade?: string; disease?: string }> }) {
  await requireRole(["clinician", "admin"]);
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const sp = await searchParams;
  const gradeF = GRADE_FILTERS.includes(sp.grade ?? "") ? sp.grade! : "all";
  const diseaseF = DISEASE_FILTERS.includes(sp.disease ?? "") ? sp.disease! : "all";
  const users = await prisma.user_account.findMany({ where: { account_type: "b2c" } });
  const ids = users.map((u) => u.id);

  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [piis, latestList, totalMeas, recentMeas] = await Promise.all([
    prisma.user_pii.findMany({ where: { user_id: { in: ids } } }),
    Promise.all(ids.map((uid) => prisma.risk_assessment.findFirst({ where: { user_id: uid }, orderBy: { risk_score: "desc" } }))),
    prisma.measurement.count({ where: { user_id: { in: ids } } }),
    prisma.measurement.count({ where: { user_id: { in: ids }, measured_at: { gte: weekAgo } } }),
  ]);
  const noName = t("patient.noName");
  const nameByUser = new Map(piis.map((p) => [p.user_id, decodeName(p.name_enc as Uint8Array | null, noName)]));
  const latestByUser = new Map(ids.map((id, i) => [id, latestList[i]]));

  const evaluated = users
    .map((u) => {
      const a = latestByUser.get(u.id);
      return {
        id: u.id, name: nameByUser.get(u.id) ?? u.pseudo_id, pseudo: u.pseudo_id,
        grade: a?.risk_grade ?? null, score: a ? Number(a.risk_score) : null,
        kdigo: a?.standard_grade ?? null, disease: a?.disease ?? null, at: a?.assessed_at ?? null,
      };
    })
    .filter((r) => r.grade);

  // 코호트 통계 (필터 전 전체 기준)
  const dist = gradeDistribution(evaluated.map((r) => r.grade));
  const highRisk = dist.very_high + dist.high;
  const diseaseCount: Record<string, number> = {};
  for (const r of evaluated) if (r.disease) diseaseCount[r.disease] = (diseaseCount[r.disease] ?? 0) + 1;
  const diseaseRanked = Object.entries(diseaseCount).sort((a, b) => b[1] - a[1]);
  const maxDisease = diseaseRanked[0]?.[1] ?? 1;

  const rows = evaluated
    .filter((r) => gradeF === "all" || r.grade === gradeF)
    .filter((r) => diseaseF === "all" || r.disease === diseaseF)
    .sort((a, b) => (SEVERITY[b.grade!] - SEVERITY[a.grade!]) || (b.at!.getTime() - a.at!.getTime()));

  const qs = (over: Partial<{ grade: string; disease: string }>) => {
    const g = over.grade ?? gradeF, d = over.disease ?? diseaseF;
    const p = new URLSearchParams();
    if (g !== "all") p.set("grade", g);
    if (d !== "all") p.set("disease", d);
    const s = p.toString();
    return s ? `/clinician/patients?${s}` : "/clinician/patients";
  };

  const filterLabel = (k: string) => (k === "all" ? t("common.all") : t(`grade.${k}`));
  const persons = (n: number) => t("portal.persons", { n });

  const KPI = [
    { label: t("portal.kpiPatients"), value: evaluated.length, sub: t("portal.kpiPatientsSub") },
    { label: t("portal.kpiHighRisk"), value: highRisk, sub: t("portal.kpiHighRiskSub"), color: highRisk > 0 ? "#D4691B" : undefined },
    { label: t("portal.kpiRecent"), value: recentMeas, sub: t("portal.kpiRecentSub") },
    { label: t("portal.kpiTotal"), value: totalMeas, sub: t("portal.kpiTotalSub") },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-7 font-sans">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E5A88]">{t("portal.title")}</h1>
          <p className="text-sm text-gray-500">{t("portal.subtitle")}</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">{t("nav.admin")} →</Link>
      </header>

      {/* KPI */}
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPI.map((k) => (
          <div key={k.label} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-400">{k.label}</div>
            <div className="num mt-1 text-2xl font-bold" style={{ color: k.color ?? "#2E5A88" }}>{k.value}</div>
            <div className="text-[11px] text-gray-400">{k.sub}</div>
          </div>
        ))}
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* 위험등급 분포 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("portal.gradeDist")}</h2>
          {evaluated.length === 0 ? <p className="text-sm text-gray-400">{t("common.noData")}</p> : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full">
                {GRADE_ORDER.map((gk) => {
                  const n = dist[gk]; if (!n) return null;
                  const g = GRADE_TOKEN[gk];
                  return <div key={gk} style={{ width: `${(n / evaluated.length) * 100}%`, background: g.color }} title={`${gradeLabel(t, gk)} ${n}`} />;
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {GRADE_ORDER.map((gk) => {
                  const g = GRADE_TOKEN[gk];
                  return (
                    <Link key={gk} href={qs({ grade: gk })} className="flex items-center justify-between rounded-lg px-2 py-1 transition hover:bg-gray-50">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} /><span className="text-gray-600">{gradeLabel(t, gk)}</span></span>
                      <span className="num font-semibold text-gray-800">{persons(dist[gk])}</span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* 질환별 분포 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("portal.diseaseDist")}</h2>
          {diseaseRanked.length === 0 ? <p className="text-sm text-gray-400">{t("common.noData")}</p> : (
            <div className="space-y-2">
              {diseaseRanked.map(([d, n]) => (
                <Link key={d} href={qs({ disease: d })} className="block">
                  <div className="mb-0.5 flex justify-between text-sm"><span className="text-gray-600">{diseaseLabel(t, d)}</span><span className="num text-gray-500">{persons(n)}</span></div>
                  <div className="h-2 rounded bg-gray-100"><div className="h-2 rounded bg-[#2E5A88]" style={{ width: `${(n / maxDisease) * 100}%` }} /></div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 필터 */}
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-gray-400">{t("patient.colGrade")}</span>
          {GRADE_FILTERS.map((f) => (
            <Link key={f} href={qs({ grade: f })} className="rounded-full border px-2.5 py-1 text-xs transition"
              style={gradeF === f ? { background: "#2E5A88", color: "#fff", borderColor: "#2E5A88" } : { color: "#6b7280", borderColor: "#e5e7eb" }}>{filterLabel(f)}</Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-gray-400">{t("patient.colDisease")}</span>
          {DISEASE_FILTERS.map((d) => (
            <Link key={d} href={qs({ disease: d })} className="rounded-full border px-2.5 py-1 text-xs transition"
              style={diseaseF === d ? { background: "#2E5A88", color: "#fff", borderColor: "#2E5A88" } : { color: "#6b7280", borderColor: "#e5e7eb" }}>{d === "all" ? t("common.all") : diseaseLabel(t, d)}</Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">{t("portal.colPatient")}</th><th className="px-4 py-2">{t("portal.colTopDisease")}</th>
              <th className="px-4 py-2">{t("patient.colGrade")}</th><th className="px-4 py-2">{t("patient.colStandard")}</th>
              <th className="px-4 py-2">{t("portal.colLastAssessed")}</th><th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const g = GRADE_TOKEN[r.grade!];
              return (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/clinician/patients/${r.id}`} className="font-semibold text-gray-800">{r.name}</Link>
                    <div className="text-[11px] text-gray-400">{r.pseudo}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{diseaseLabel(t, r.disease)}</td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: g.color }}>{gradeLabel(t, r.grade)} {r.score?.toFixed(2)}</span></td>
                  <td className="px-4 py-3 text-gray-600">{r.kdigo ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{r.at && fmtDateTime(locale, r.at)}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/clinician/patients/${r.id}/report`} className="text-xs font-semibold text-[#2E5A88]">{t("portal.report")} →</Link></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t("portal.noMatch")}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-400">
        {t("portal.disclaimer")}
      </p>
    </main>
  );
}
