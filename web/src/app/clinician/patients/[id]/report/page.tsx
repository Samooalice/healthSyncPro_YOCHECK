// 의료진 임상 리포트 (C-CLN) — 근거 중심·정량·인쇄용 종합 리포트. (9.4 / 콘텐츠원고집 7.1)
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import TrendChart, { type TrendPoint } from "@/components/TrendChart";
import PrintButton from "@/components/PrintButton";
import { GRADE_TOKEN, ANALYTE_KO, DISEASE_KO, CARE_KO } from "@/lib/ui/labels";
import { ANALYTE_META, formatAnalyte, analyteStatus, normalText, STATUS_COLOR, STATUS_LABEL } from "@/lib/ui/analyte";
import { ANALYTE_CLINICAL, DISEASE_GUIDELINE } from "@/lib/ui/clinical";
import type { Analyte } from "@/config/algoParams";

export const dynamic = "force-dynamic";

const ANALYTES: Analyte[] = ["protein", "blood", "leukocyte", "glucose", "ketone", "nitrite", "bilirubin", "urobilinogen", "specific_gravity", "ph", "vitamin_c"];

interface ShapItem { analyte: string; feature: string; contribution: number }
function decodeName(buf: Uint8Array | null): string {
  if (!buf) return "(이름 없음)";
  try { return Buffer.from(buf).toString("utf8"); } catch { return "(이름 없음)"; }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ClinicalReport({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole(["clinician", "admin"]);
  const { id } = await params;
  const user = await prisma.user_account.findUnique({ where: { id } });
  if (!user) notFound();
  await audit(me.id, "view_phi", `patient:${id}`, { context: "clinical_report" });

  const [pii, history, phr] = await Promise.all([
    prisma.user_pii.findUnique({ where: { user_id: id } }),
    prisma.measurement.findMany({ where: { user_id: id }, orderBy: { measured_at: "asc" }, take: 30 }),
    prisma.phr_record.findFirst({ where: { user_id: id } }),
  ]);
  const latestMeas = history[history.length - 1];
  const assessments = latestMeas
    ? await prisma.risk_assessment.findMany({ where: { measurement_id: latestMeas.id }, orderBy: { risk_score: "desc" } })
    : [];
  const top = assessments[0] ?? null;
  const [explanation, careActions] = top
    ? await Promise.all([
        prisma.explanation.findUnique({ where: { assessment_id: top.id } }),
        prisma.care_action.findMany({ where: { assessment_id: top.id } }),
      ])
    : [null, []];

  const name = decodeName(pii?.name_enc as Uint8Array | null);
  const shap = ((explanation?.shap_values as ShapItem[] | null) ?? []).filter((s) => s.contribution > 0);
  const proteinTrend: TrendPoint[] = history.map((m) => (m.protein != null ? { date: m.measured_at.toISOString(), value: Number(m.protein) } : null)).filter((p): p is TrendPoint => p !== null);
  const phrS = phr?.summary as any;
  const phrF = phr?.flags as any;
  const pm = (k: string) => phrS?.checkups?.[0]?.metrics?.[k]?.num ?? null;
  const period = history.length ? `${history[0].measured_at.toISOString().slice(0, 10)} ~ ${latestMeas.measured_at.toISOString().slice(0, 10)}` : "-";
  const sexKo = pii?.sex === "M" ? "남" : pii?.sex === "F" ? "여" : "—";
  const age = pii?.birth_year ? new Date().getFullYear() - pii.birth_year : null;
  const guide = top ? DISEASE_GUIDELINE[top.disease] : null;
  const mv = (a: Analyte): number | null => (latestMeas ? ((latestMeas as any)[a] == null ? null : Number((latestMeas as any)[a])) : null);
  const abnormal = ANALYTES.map((a) => ({ a, v: mv(a), st: analyteStatus(a, mv(a)) })).filter((x) => x.st === "abnormal" || x.st === "caution");

  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-8 print:px-0 print:py-0">
      <header className="mb-5 flex items-center justify-between border-b-2 border-ink pb-3">
        <div>
          <Link href={`/clinician/patients/${id}`} className="text-xs text-gray-400 print:hidden">← 환자 대시보드</Link>
          <h1 className="text-2xl font-bold text-ink">임상 분석 리포트</h1>
          <p className="text-xs text-gray-500">SDC WellCare · 요화학 + 마이헬스데이터 결합 분석</p>
        </div>
        <PrintButton />
      </header>

      {/* 환자 요약 */}
      <section className="mb-5 grid grid-cols-3 gap-x-6 gap-y-1 text-sm sm:grid-cols-6">
        {[["대상", name], ["성별", sexKo], ["나이", age == null ? "—" : `${age}세`], ["가명 ID", user.pseudo_id], ["관찰 기간", period], ["측정 횟수", `${history.length}회`]].map(([l, v]) => (
          <div key={l}><div className="text-[11px] text-gray-400">{l}</div><div className="num font-medium text-gray-800">{v}</div></div>
        ))}
      </section>

      {!top ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">평가 데이터가 없습니다.</p>
      ) : (
        <>
          {/* 다질환 위험 (SaMD) */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink">다질환 위험 평가 <span className="text-[11px] font-normal text-gray-400">(SaMD 후보 출력 · 모델 {top.model_version})</span></h2>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-xs text-gray-500">
                <tr><th className="py-1">질환</th><th className="py-1">위험점수</th><th className="py-1">등급</th><th className="py-1">표준등급(KDIGO형)</th></tr>
              </thead>
              <tbody>
                {assessments.map((a) => {
                  const g = GRADE_TOKEN[a.risk_grade] ?? GRADE_TOKEN.low;
                  return (
                    <tr key={a.id} className="border-b border-gray-50">
                      <td className="py-1.5 text-gray-700">{DISEASE_KO[a.disease] ?? a.disease}</td>
                      <td className="num py-1.5 text-gray-700">{Number(a.risk_score).toFixed(3)}</td>
                      <td className="py-1.5"><span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: g.color }}>{g.label}</span></td>
                      <td className="py-1.5 text-gray-600">{a.standard_grade ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* 근거 (SHAP) */}
          {shap.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-2 text-sm font-bold text-ink">근거 — 주요 기여 요인 ({DISEASE_KO[top.disease]})</h2>
              <ul className="space-y-1 text-sm text-gray-700">
                {shap.slice(0, 5).map((s) => (
                  <li key={s.feature} className="flex justify-between border-b border-gray-50 py-0.5">
                    <span>{ANALYTE_KO[s.analyte] ?? s.analyte} <span className="text-xs text-gray-400">{s.feature}</span></span>
                    <span className="num text-gray-500">기여 {s.contribution.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              {explanation?.text_clinician && <p className="mt-2 text-xs leading-relaxed text-gray-600">{explanation.text_clinician}</p>}
            </section>
          )}

          {/* 이상소견 요약 */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink">이상소견 요약</h2>
            {abnormal.length === 0 ? (
              <p className="text-sm text-gray-500">요화학 11항목 모두 정상 범위입니다.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {abnormal.map(({ a, v, st }) => (
                  <span key={a} className="rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: STATUS_COLOR[st], color: STATUS_COLOR[st] }}>
                    {ANALYTE_META[a]?.name ?? a} <b>{formatAnalyte(a, v)}</b> · {STATUS_LABEL[st]}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* 추세 */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink">요단백 추세</h2>
            <TrendChart data={proteinTrend} analyteLabel="요단백" color="#2E5A88" normal={ANALYTE_META.protein.normal} valueFormat={(v) => formatAnalyte("protein", v)} />
          </section>

          {/* 요화학 정량해석 (11항목) */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink">요화학 정량해석 (11항목)</h2>
            <table className="w-full text-xs">
              <thead className="border-b border-gray-200 text-left text-gray-400">
                <tr><th className="py-1">항목</th><th className="py-1">측정값</th><th className="py-1">정상</th><th className="py-1">판정</th><th className="py-1">임상적 의의</th></tr>
              </thead>
              <tbody>
                {ANALYTES.map((a) => {
                  const v = mv(a); const st = analyteStatus(a, v); const abn = st === "abnormal" || st === "caution";
                  return (
                    <tr key={a} className="border-b border-gray-50 align-top">
                      <td className="py-1 text-gray-600">{ANALYTE_META[a]?.name ?? ANALYTE_KO[a]}</td>
                      <td className="num py-1 font-medium text-gray-800">{formatAnalyte(a, v)}</td>
                      <td className="py-1 text-gray-400">{normalText(a)}</td>
                      <td className="py-1"><span className="font-semibold" style={{ color: STATUS_COLOR[st] }}>{STATUS_LABEL[st]}</span></td>
                      <td className="py-1 leading-relaxed" style={{ color: abn ? "#7a5230" : "#cbd0d6" }}>{abn ? ANALYTE_CLINICAL[a]?.significance ?? "" : "정상 범위"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* 가이드라인 참고 */}
          {guide && (
            <section className="mb-5">
              <h2 className="mb-2 text-sm font-bold text-ink">가이드라인 참고 · {DISEASE_KO[top.disease]}</h2>
              <p className="text-sm font-medium text-[#2E5A88]">{guide.reference}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600"><b className="text-gray-500">병기 해석</b> · {guide.staging}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-600"><b className="text-gray-500">권고 추적</b> · {guide.followup}</p>
            </section>
          )}

          {/* 마이헬스데이터(PHR) */}
          {phr && (
            <section className="mb-5">
              <h2 className="mb-2 text-sm font-bold text-ink">마이헬스데이터 (국가검진·복약)</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm sm:grid-cols-4">
                {[["공복혈당", pm("glucose"), "mg/dL"], ["eGFR", pm("egfr"), ""], ["BMI", pm("bmi"), ""], ["총콜레스테롤", pm("chol"), ""]].map(([l, v, u]) => (
                  <div key={l as string} className="flex justify-between border-b border-gray-50 py-0.5"><span className="text-gray-500">{l}</span><span className="num text-gray-800">{v == null ? "-" : `${v}${u ? " " + u : ""}`}</span></div>
                ))}
              </div>
              {phrS?.med_classes?.length > 0 && <p className="mt-1 text-xs text-gray-600">복약 분류: {phrS.med_classes.join(", ")}</p>}
              {phrS?.diagnoses?.length > 0 && <p className="text-xs text-gray-600">진단/소견: {phrS.diagnoses.join(" · ")}</p>}
              {phrF && <p className="text-xs text-gray-600">만성질환 플래그: {["당뇨", "고혈압", "이상지질혈증", "신장주의", "과체중"].filter((_, i) => [phrF.diabetes, phrF.hypertension, phrF.dyslipidemia, phrF.kidney_watch, phrF.overweight][i]).join(", ") || "없음"}</p>}
            </section>
          )}

          {/* 만관제 케어플랜 */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink">케어플랜 · 만관제 요약</h2>
            <ul className="text-sm text-gray-700">
              {careActions.map((c) => <li key={c.id}>• {CARE_KO[c.action_type] ?? c.action_type}{c.due_at && ` (${new Date(c.due_at).toLocaleDateString("ko-KR")})`}</li>)}
              {careActions.length === 0 && <li className="text-gray-400">케어 액션 없음</li>}
            </ul>
            <p className="mt-1 text-xs text-gray-400">참고 가이드라인 인용·만관제 행정 폼 자동생성은 EMR 연동 시 확장됩니다.</p>
          </section>
        </>
      )}

      <p className="border-t border-gray-200 pt-3 text-xs leading-relaxed text-gray-400">
        본 리포트는 요화학 검사와 마이헬스데이터(PHR)를 결합한 선별 분석 결과로, 임상적 진단·처방을 대체하지 않습니다.
        위험계층화·등급 산출은 의료기기(SaMD) 인허가를 전제로 합니다. 최종 판단은 의료진의 임상적 평가에 따릅니다.
      </p>
    </main>
  );
}
