// 의료진 포털 — 환자 목록 + 코호트 요약 (9.4). 위험순 정렬, 가명ID·등급분포·질환분포·필터.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { GRADE_TOKEN, DISEASE_KO } from "@/lib/ui/labels";
import { gradeDistribution } from "@/lib/ui/clinical";

export const dynamic = "force-dynamic";

const SEVERITY: Record<string, number> = { very_high: 3, high: 2, moderate: 1, low: 0 };
const GRADE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "전체" }, { key: "very_high", label: "높음" },
  { key: "high", label: "주의" }, { key: "moderate", label: "관찰" }, { key: "low", label: "양호" },
];
const DISEASE_FILTERS = ["all", "kidney", "diabetes", "hypertension", "uti", "liver"];
const GRADE_ORDER = ["very_high", "high", "moderate", "low"] as const;

function decodeName(buf: Uint8Array | null): string {
  if (!buf) return "(이름 없음)";
  try { return Buffer.from(buf).toString("utf8"); } catch { return "(이름 없음)"; }
}

export default async function PatientListPage({ searchParams }: { searchParams: Promise<{ grade?: string; disease?: string }> }) {
  await requireRole(["clinician", "admin"]);
  const sp = await searchParams;
  const gradeF = GRADE_FILTERS.some((f) => f.key === sp.grade) ? sp.grade! : "all";
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
  const nameByUser = new Map(piis.map((p) => [p.user_id, decodeName(p.name_enc as Uint8Array | null)]));
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

  const KPI = [
    { label: "관리 환자", value: evaluated.length, sub: "평가 보유" },
    { label: "고위험", value: highRisk, sub: "높음+주의", color: highRisk > 0 ? "#D4691B" : undefined },
    { label: "최근 7일 측정", value: recentMeas, sub: "신규 유입" },
    { label: "누적 측정", value: totalMeas, sub: "전체 검사" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-7 font-sans">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E5A88]">의료진 포털</h1>
          <p className="text-sm text-gray-500">관리 코호트 현황과 위험 우선순위를 한눈에 확인하세요 · 가명 기반</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">관리자 →</Link>
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
          <h2 className="mb-3 text-sm font-semibold text-gray-700">위험등급 분포</h2>
          {evaluated.length === 0 ? <p className="text-sm text-gray-400">데이터 없음</p> : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full">
                {GRADE_ORDER.map((gk) => {
                  const n = dist[gk]; if (!n) return null;
                  const g = GRADE_TOKEN[gk];
                  return <div key={gk} style={{ width: `${(n / evaluated.length) * 100}%`, background: g.color }} title={`${g.label} ${n}`} />;
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {GRADE_ORDER.map((gk) => {
                  const g = GRADE_TOKEN[gk];
                  return (
                    <Link key={gk} href={qs({ grade: gk })} className="flex items-center justify-between rounded-lg px-2 py-1 transition hover:bg-gray-50">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} /><span className="text-gray-600">{g.label}</span></span>
                      <span className="num font-semibold text-gray-800">{dist[gk]}명</span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* 질환별 분포 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">대표 위험질환 분포</h2>
          {diseaseRanked.length === 0 ? <p className="text-sm text-gray-400">데이터 없음</p> : (
            <div className="space-y-2">
              {diseaseRanked.map(([d, n]) => (
                <Link key={d} href={qs({ disease: d })} className="block">
                  <div className="mb-0.5 flex justify-between text-sm"><span className="text-gray-600">{DISEASE_KO[d] ?? d}</span><span className="num text-gray-500">{n}명</span></div>
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
          <span className="mr-1 text-xs text-gray-400">등급</span>
          {GRADE_FILTERS.map((f) => (
            <Link key={f.key} href={qs({ grade: f.key })} className="rounded-full border px-2.5 py-1 text-xs transition"
              style={gradeF === f.key ? { background: "#2E5A88", color: "#fff", borderColor: "#2E5A88" } : { color: "#6b7280", borderColor: "#e5e7eb" }}>{f.label}</Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-gray-400">질환</span>
          {DISEASE_FILTERS.map((d) => (
            <Link key={d} href={qs({ disease: d })} className="rounded-full border px-2.5 py-1 text-xs transition"
              style={diseaseF === d ? { background: "#2E5A88", color: "#fff", borderColor: "#2E5A88" } : { color: "#6b7280", borderColor: "#e5e7eb" }}>{d === "all" ? "전체" : DISEASE_KO[d] ?? d}</Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">환자</th><th className="px-4 py-2">대표 위험질환</th>
              <th className="px-4 py-2">등급</th><th className="px-4 py-2">표준등급</th>
              <th className="px-4 py-2">최근 평가</th><th className="px-4 py-2"></th>
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
                  <td className="px-4 py-3 text-gray-600">{DISEASE_KO[r.disease!] ?? r.disease}</td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: g.color }}>{g.label} {r.score?.toFixed(2)}</span></td>
                  <td className="px-4 py-3 text-gray-600">{r.kdigo ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{r.at && new Date(r.at).toLocaleString("ko-KR", { hour12: false })}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/clinician/patients/${r.id}/report`} className="text-xs font-semibold text-[#2E5A88]">리포트 →</Link></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">조건에 맞는 환자가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-400">
        ※ 위험계층화·등급은 의료기기(SaMD) 후보 출력입니다. 임상적 진단·처방을 대체하지 않으며 최종 판단은 의료진의 임상적 평가에 따릅니다.
      </p>
    </main>
  );
}
