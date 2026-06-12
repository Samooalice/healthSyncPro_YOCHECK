// 의료진 포털 — 환자 임상 대시보드 (9.4 / 콘텐츠원고집 7.1)
// 근거 중심: 인구학·다질환 위험·요화학 정량해석·추세·SHAP·PHR·가이드라인·만관제.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import TrendChart, { type TrendPoint } from "@/components/TrendChart";
import { GRADE_TOKEN, ANALYTE_KO, CARE_KO, DISEASE_KO } from "@/lib/ui/labels";
import { ANALYTE_META, formatAnalyte, analyteStatus, normalText, STATUS_COLOR, STATUS_LABEL } from "@/lib/ui/analyte";
import { ANALYTE_CLINICAL, DISEASE_GUIDELINE } from "@/lib/ui/clinical";
import type { Analyte } from "@/config/algoParams";

export const dynamic = "force-dynamic";

const ANALYTES: Analyte[] = [
  "protein", "glucose", "blood", "leukocyte", "nitrite", "ketone",
  "bilirubin", "urobilinogen", "specific_gravity", "ph", "vitamin_c",
];
const DISEASE_TREND: Record<string, Analyte> = {
  kidney: "protein", diabetes: "glucose", hypertension: "protein", uti: "leukocyte", liver: "bilirubin",
};

interface ShapItem { analyte: string; feature: string; contribution: number }

function decodeName(buf: Uint8Array | null): string {
  if (!buf) return "(이름 없음)";
  try { return Buffer.from(buf).toString("utf8"); } catch { return "(이름 없음)"; }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole(["clinician", "admin"]);
  const { id } = await params;
  const user = await prisma.user_account.findUnique({ where: { id } });
  if (!user) notFound();
  await audit(me.id, "view_phi", `patient:${id}`, { context: "patient_detail" });

  const [pii, history, phr] = await Promise.all([
    prisma.user_pii.findUnique({ where: { user_id: id } }),
    prisma.measurement.findMany({ where: { user_id: id }, orderBy: { measured_at: "asc" }, take: 30 }),
    prisma.phr_record.findFirst({ where: { user_id: id } }),
  ]);
  const latestMeas = history[history.length - 1];
  const diseaseAssessments = latestMeas
    ? await prisma.risk_assessment.findMany({ where: { measurement_id: latestMeas.id }, orderBy: { risk_score: "desc" } })
    : [];
  const latest = diseaseAssessments[0] ?? null;
  const [explanation, careActions] = latest
    ? await Promise.all([
        prisma.explanation.findUnique({ where: { assessment_id: latest.id } }),
        prisma.care_action.findMany({ where: { assessment_id: latest.id } }),
      ])
    : [null, []];

  const name = decodeName(pii?.name_enc as Uint8Array | null);
  const g = latest ? GRADE_TOKEN[latest.risk_grade] ?? GRADE_TOKEN.low : null;
  const shapTop = ((explanation?.shap_values as ShapItem[] | null) ?? []).filter((s) => s.contribution > 0);
  const guide = latest ? DISEASE_GUIDELINE[latest.disease] : null;

  // 인구학
  const sexKo = pii?.sex === "M" ? "남" : pii?.sex === "F" ? "여" : "—";
  const age = pii?.birth_year ? new Date().getFullYear() - pii.birth_year : null;
  const period = history.length ? `${history[0].measured_at.toISOString().slice(0, 10)} ~ ${latestMeas.measured_at.toISOString().slice(0, 10)}` : "—";

  // 추세 (대표질환 항목 + 요단백)
  const mainAnalyte: Analyte = latest ? DISEASE_TREND[latest.disease] ?? "protein" : "protein";
  const trendOf = (a: Analyte): TrendPoint[] => history.map((m) => { const v = (m as any)[a]; return v != null ? { date: m.measured_at.toISOString(), value: Number(v) } : null; }).filter((p): p is TrendPoint => p !== null);
  const mv = (a: Analyte): number | null => (latestMeas ? ((latestMeas as any)[a] == null ? null : Number((latestMeas as any)[a])) : null);

  // 이상소견 요약
  const abnormal = ANALYTES.map((a) => ({ a, v: mv(a), st: analyteStatus(a, mv(a)) })).filter((x) => x.st === "abnormal" || x.st === "caution");

  // PHR
  const phrFlags: any = phr?.flags ?? null;
  const phrSummary: any = phr?.summary ?? null;
  const phrMetric = (k: string): number | null => phrSummary?.checkups?.[0]?.metrics?.[k]?.num ?? null;
  const phrActiveFlags: string[] = phrFlags
    ? ([["당뇨", phrFlags.diabetes], ["고혈압", phrFlags.hypertension], ["이상지질혈증", phrFlags.dyslipidemia], ["신장주의", phrFlags.kidney_watch], ["과체중", phrFlags.overweight]] as [string, boolean][]).filter(([, v]) => v).map(([l]) => l)
    : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-7 font-sans">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/clinician/patients" className="text-sm text-gray-400">← 환자 목록</Link>
        <h1 className="text-2xl font-bold text-[#2E5A88]">{name}</h1>
        <span className="text-xs text-gray-400">{user.pseudo_id}</span>
        <Link href={`/clinician/patients/${id}/report`} className="ml-auto rounded-lg border border-[#2E5A88]/30 px-3 py-1.5 text-sm font-medium text-[#2E5A88] transition hover:bg-[#2E5A88]/5">
          임상 리포트 →
        </Link>
      </header>

      {/* 인구학 요약 */}
      <section className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1 rounded-2xl border border-gray-200 bg-white p-4 text-sm sm:grid-cols-4">
        {[["성별", sexKo], ["나이", age == null ? "—" : `${age}세`], ["관찰 기간", period], ["측정 횟수", `${history.length}회`]].map(([l, v]) => (
          <div key={l}><div className="text-[11px] text-gray-400">{l}</div><div className="num font-medium text-gray-800">{v}</div></div>
        ))}
      </section>

      {!latest && <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400">평가 데이터가 없습니다.</p>}

      {latest && g && (
        <div className="space-y-5">
          {/* 위험 평가 (SaMD 출력) — 다질환 */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">위험 평가 (SaMD 출력) · 다질환</div>
              <span className="text-xs text-gray-400">모델 {latest.model_version}</span>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr><th className="px-3 py-1.5">질환</th><th className="px-3 py-1.5">위험점수</th><th className="px-3 py-1.5">등급</th><th className="px-3 py-1.5">표준등급</th></tr>
                </thead>
                <tbody>
                  {diseaseAssessments.map((d) => {
                    const dg = GRADE_TOKEN[d.risk_grade] ?? GRADE_TOKEN.low;
                    return (
                      <tr key={d.id} className="border-t border-gray-50">
                        <td className="px-3 py-2 text-gray-700">{DISEASE_KO[d.disease] ?? d.disease}</td>
                        <td className="num px-3 py-2 text-gray-700">{Number(d.risk_score).toFixed(2)}</td>
                        <td className="px-3 py-2"><span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: dg.color }}>{dg.label}</span></td>
                        <td className="px-3 py-2 text-gray-500">{d.standard_grade ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {explanation?.text_clinician && <p className="mt-3 text-sm leading-relaxed text-gray-700">{explanation.text_clinician}</p>}
          </section>

          {/* 이상소견 요약 배너 */}
          {abnormal.length > 0 && (
            <section className="rounded-2xl border-l-4 border-[#D4691B] bg-[#FFF8F3] p-4">
              <div className="text-sm font-semibold text-[#a6541b]">이상소견 {abnormal.length}건</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {abnormal.map(({ a, v, st }) => (
                  <span key={a} className="rounded-full bg-white px-2.5 py-1 text-xs" style={{ color: STATUS_COLOR[st] }}>
                    {ANALYTE_META[a]?.name ?? a} <b>{formatAnalyte(a, v)}</b> · {STATUS_LABEL[st]}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* 추세 (2개) */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <TrendChart data={trendOf(mainAnalyte)} analyteLabel={ANALYTE_META[mainAnalyte]?.name ?? mainAnalyte}
                color={STATUS_COLOR[analyteStatus(mainAnalyte, mv(mainAnalyte))]} normal={ANALYTE_META[mainAnalyte]?.normal} valueFormat={(v) => formatAnalyte(mainAnalyte, v)} />
              <p className="mt-1 text-[11px] text-gray-400">대표질환({DISEASE_KO[latest.disease]}) 관련 지표</p>
            </div>
            {mainAnalyte !== "protein" && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <TrendChart data={trendOf("protein")} analyteLabel="요단백" color={STATUS_COLOR[analyteStatus("protein", mv("protein"))]} normal={ANALYTE_META.protein.normal} valueFormat={(v) => formatAnalyte("protein", v)} />
                <p className="mt-1 text-[11px] text-gray-400">신기능(단백뇨) 지표</p>
              </div>
            )}
          </section>

          {/* 요화학 정량해석 (11항목 + 임상적 의의) */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">요화학 정량해석 (11항목)</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr><th className="pb-1.5">항목</th><th className="pb-1.5">측정값</th><th className="pb-1.5">정상</th><th className="pb-1.5">판정</th><th className="pb-1.5">임상적 의의</th></tr>
              </thead>
              <tbody>
                {ANALYTES.map((a) => {
                  const v = mv(a); const st = analyteStatus(a, v);
                  const abn = st === "abnormal" || st === "caution";
                  return (
                    <tr key={a} className="border-t border-gray-50 align-top">
                      <td className="py-2 text-gray-600">{ANALYTE_META[a]?.name ?? ANALYTE_KO[a] ?? a}</td>
                      <td className="num py-2 font-medium text-gray-800">{formatAnalyte(a, v)}</td>
                      <td className="py-2 text-xs text-gray-400">{normalText(a)}</td>
                      <td className="py-2"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: STATUS_COLOR[st] }}>{STATUS_LABEL[st]}</span></td>
                      <td className="py-2 text-xs leading-relaxed" style={{ color: abn ? "#7a5230" : "#cbd0d6" }}>{abn ? ANALYTE_CLINICAL[a]?.significance ?? "" : "정상 범위"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* 근거 (SHAP) */}
          {shapTop.length > 0 && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-3 text-sm font-semibold text-gray-700">위험 기여 요인 (SHAP) · {DISEASE_KO[latest.disease]}</div>
              <div className="space-y-2">
                {shapTop.map((s) => (
                  <div key={s.feature} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 text-gray-600">{ANALYTE_KO[s.analyte] ?? s.analyte} <span className="text-xs text-gray-400">{s.feature}</span></span>
                    <div className="h-3 flex-1 rounded bg-gray-100"><div className="h-3 rounded" style={{ width: `${Math.min(100, s.contribution * 200)}%`, background: g.color }} /></div>
                    <span className="num w-12 text-right text-gray-500">{s.contribution.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 가이드라인 단서 */}
          {guide && (
            <section className="rounded-2xl border border-gray-200 bg-[#f8fafc] p-5">
              <div className="mb-1 text-sm font-semibold text-gray-700">가이드라인 참고 · {DISEASE_KO[latest.disease]}</div>
              <p className="text-sm font-medium text-[#2E5A88]">{guide.reference}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-600"><b className="text-gray-500">병기 해석</b> · {guide.staging}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600"><b className="text-gray-500">권고 추적</b> · {guide.followup}</p>
            </section>
          )}

          {/* 마이헬스데이터(PHR) */}
          {phr && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700">마이헬스데이터 (국가검진·복약)</div>
                <span className="text-xs text-gray-400">검진 {phrSummary?.checkups?.length ?? 0}건 · 복약 {phrSummary?.medications?.length ?? 0}종</span>
              </div>
              {phrActiveFlags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {phrActiveFlags.map((l) => <span key={l} className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "#FCEBDD", color: "#d4691b" }}>{l}</span>)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                {([["공복혈당", phrMetric("glucose"), "mg/dL", "<100"], ["eGFR", phrMetric("egfr"), "", "≥90"], ["BMI", phrMetric("bmi"), "", "18.5~24.9"], ["총콜레스테롤", phrMetric("chol"), "", "<200"]] as [string, number | null, string, string][]).map(([l, v, u, ref]) => (
                  <div key={l} className="flex items-baseline justify-between border-b border-gray-50 py-0.5">
                    <span className="text-gray-500">{l}</span>
                    <span><span className="num font-medium text-gray-800">{v == null ? "-" : `${v}${u ? " " + u : ""}`}</span> <span className="text-[10px] text-gray-300">정상 {ref}</span></span>
                  </div>
                ))}
              </div>
              {phrSummary?.med_classes?.length > 0 && <p className="mt-2 text-xs text-gray-500">복약 분류: {phrSummary.med_classes.join(", ")}</p>}
              {phrSummary?.diagnoses?.length > 0 && <p className="mt-1 text-xs text-gray-500">진단/소견: {phrSummary.diagnoses.join(" · ")}</p>}
            </section>
          )}

          {/* 케어플랜 */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-1 text-sm font-semibold text-gray-700">케어플랜 · 만관제 요약</div>
            <ul className="text-sm text-gray-700">
              {careActions.map((c) => <li key={c.id}>• {CARE_KO[c.action_type] ?? c.action_type}{c.due_at && ` (${new Date(c.due_at).toLocaleDateString("ko-KR")})`}</li>)}
              {careActions.length === 0 && <li className="text-gray-400">케어 액션 없음</li>}
            </ul>
            <p className="mt-2 text-xs text-gray-400">참고 가이드라인·만관제 행정 폼 자동생성은 EMR 연동(Step 6+)에서 채워집니다.</p>
          </section>

          <p className="text-xs leading-relaxed text-gray-400">
            본 요약은 선별 분석 결과로, 임상적 진단·처방을 대체하지 않습니다. 위험계층화·등급 산출은 의료기기(SaMD) 인허가를 전제로 합니다. 최종 판단은 의료진의 임상적 평가에 따릅니다.
          </p>
        </div>
      )}
    </main>
  );
}
