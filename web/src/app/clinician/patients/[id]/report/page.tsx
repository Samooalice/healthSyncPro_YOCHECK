// 의료진 임상 리포트 (C-CLN) — 근거 중심·정량·인쇄용 종합 리포트. (9.4 / 콘텐츠원고집 7.1)
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import TrendChart, { type TrendPoint } from "@/components/TrendChart";
import PrintButton from "@/components/PrintButton";
import { GRADE_TOKEN, gradeLabel, careLabel, diseaseLabel, featureLabel } from "@/lib/ui/labels";
import { ANALYTE_META, analyteName, formatAnalyte, analyteStatus, normalText, STATUS_COLOR, statusLabel } from "@/lib/ui/analyte";
import { analyteSignificance, diseaseGuideline } from "@/lib/ui/clinical";
import { localizeExplanation } from "@/lib/ui/explanation";
import { medClassList } from "@/lib/ui/phr";
import { opinionList } from "@/lib/ui/phrOpinion";
import { fmtDate } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import type { Analyte } from "@/config/algoParams";

export const dynamic = "force-dynamic";

const ANALYTES: Analyte[] = ["protein", "blood", "leukocyte", "glucose", "ketone", "nitrite", "bilirubin", "urobilinogen", "specific_gravity", "ph", "vitamin_c"];
const PHR_FLAG_KEYS = ["diabetes", "hypertension", "dyslipidemia", "kidney_watch", "overweight"] as const;

interface ShapItem { analyte: string; feature: string; contribution: number }

function decodeName(buf: Uint8Array | null, fallback: string): string {
  if (!buf) return fallback;
  try { return Buffer.from(buf).toString("utf8"); } catch { return fallback; }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ClinicalReport({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole(["clinician", "admin"]);
  const { id } = await params;
  const user = await prisma.user_account.findUnique({ where: { id } });
  if (!user) notFound();
  await audit(me.id, "view_phi", `patient:${id}`, { context: "clinical_report" });

  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

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

  const name = decodeName(pii?.name_enc as Uint8Array | null, t("patient.noName"));
  const shap = ((explanation?.shap_values as ShapItem[] | null) ?? []).filter((s) => s.contribution > 0);
  const proteinTrend: TrendPoint[] = history.map((m) => (m.protein != null ? { date: m.measured_at.toISOString(), value: Number(m.protein) } : null)).filter((p): p is TrendPoint => p !== null);
  const phrS = phr?.summary as any;
  const phrF = phr?.flags as any;
  const pm = (k: string) => phrS?.checkups?.[0]?.metrics?.[k]?.num ?? null;
  const period = history.length ? `${history[0].measured_at.toISOString().slice(0, 10)} ~ ${latestMeas.measured_at.toISOString().slice(0, 10)}` : "-";
  const sexLabel = pii?.sex === "M" ? t("patient.male") : pii?.sex === "F" ? t("patient.female") : "—";
  const age = pii?.birth_year ? new Date().getFullYear() - pii.birth_year : null;
  const guide = top ? diseaseGuideline(t, top.disease) : null;
  const explained = localizeExplanation(t, explanation);
  const mv = (a: Analyte): number | null => (latestMeas ? ((latestMeas as any)[a] == null ? null : Number((latestMeas as any)[a])) : null);
  const abnormal = ANALYTES.map((a) => ({ a, v: mv(a), st: analyteStatus(a, mv(a)) })).filter((x) => x.st === "abnormal" || x.st === "caution");

  const summaryRows: [string, string][] = [
    [t("report.subject"), name],
    [t("patient.sex"), sexLabel],
    [t("patient.age"), age == null ? "—" : t("patient.years", { n: age })],
    [t("report.pseudoId"), user.pseudo_id],
    [t("patient.period"), period],
    [t("patient.measureCount"), t("patient.times", { n: history.length })],
  ];

  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-8 print:px-0 print:py-0">
      <header className="mb-5 flex items-center justify-between border-b-2 border-ink pb-3">
        <div>
          <Link href={`/clinician/patients/${id}`} className="text-xs text-gray-400 print:hidden">← {t("report.backToPatient")}</Link>
          <h1 className="text-2xl font-bold text-ink">{t("report.title")}</h1>
          <p className="text-xs text-gray-500">SDC WellCare · {t("report.subtitle")}</p>
        </div>
        <PrintButton />
      </header>

      {/* 환자 요약 */}
      <section className="mb-5 grid grid-cols-3 gap-x-6 gap-y-1 text-sm sm:grid-cols-6">
        {summaryRows.map(([l, v]) => (
          <div key={l}><div className="text-[11px] text-gray-400">{l}</div><div className="num font-medium text-gray-800">{v}</div></div>
        ))}
      </section>

      {!top ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">{t("patient.noAssessment")}</p>
      ) : (
        <>
          {/* 다질환 위험 (SaMD) */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink">
              {t("report.multiRisk")} <span className="text-[11px] font-normal text-gray-400">({t("report.samdCandidate", { version: top.model_version })})</span>
            </h2>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-xs text-gray-500">
                <tr>
                  <th className="py-1">{t("patient.colDisease")}</th>
                  <th className="py-1">{t("patient.colScore")}</th>
                  <th className="py-1">{t("patient.colGrade")}</th>
                  <th className="py-1">{t("report.colStandardKdigo")}</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => {
                  const g = GRADE_TOKEN[a.risk_grade] ?? GRADE_TOKEN.low;
                  return (
                    <tr key={a.id} className="border-b border-gray-50">
                      <td className="py-1.5 text-gray-700">{diseaseLabel(t, a.disease)}</td>
                      <td className="num py-1.5 text-gray-700">{Number(a.risk_score).toFixed(3)}</td>
                      <td className="py-1.5"><span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: g.color }}>{gradeLabel(t, a.risk_grade)}</span></td>
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
              <h2 className="mb-2 text-sm font-bold text-ink">{t("report.evidenceTitle")} ({diseaseLabel(t, top.disease)})</h2>
              <ul className="space-y-1 text-sm text-gray-700">
                {shap.slice(0, 5).map((s) => (
                  <li key={s.feature} className="flex justify-between border-b border-gray-50 py-0.5">
                    <span>{featureLabel(t, s.analyte, s.feature)} <span className="text-xs text-gray-400">{s.analyte}</span></span>
                    <span className="num text-gray-500">{t("report.contribution", { value: s.contribution.toFixed(2) })}</span>
                  </li>
                ))}
              </ul>
              {explained?.text_clinician && <p className="mt-2 text-xs leading-relaxed text-gray-600">{explained.text_clinician}</p>}
            </section>
          )}

          {/* 이상소견 요약 */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink">{t("report.abnormalTitle")}</h2>
            {abnormal.length === 0 ? (
              <p className="text-sm text-gray-500">{t("report.allNormal")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {abnormal.map(({ a, v, st }) => (
                  <span key={a} className="rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: STATUS_COLOR[st], color: STATUS_COLOR[st] }}>
                    {analyteName(t, a)} <b>{formatAnalyte(t, a, v)}</b> · {statusLabel(t, st)}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* 추세 */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink">{t("report.proteinTrend")}</h2>
            <TrendChart t={t} data={proteinTrend} analyteLabel={analyteName(t, "protein")} color="#2E5A88" normal={ANALYTE_META.protein.normal} valueFormat={(v) => formatAnalyte(t, "protein", v)} />
          </section>

          {/* 요화학 정량해석 (11항목) */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink">{t("patient.quantTitle")}</h2>
            <table className="w-full text-xs">
              <thead className="border-b border-gray-200 text-left text-gray-400">
                <tr>
                  <th className="py-1">{t("result.colItem")}</th>
                  <th className="py-1">{t("result.colValue")}</th>
                  <th className="py-1">{t("status.normal")}</th>
                  <th className="py-1">{t("result.colJudgment")}</th>
                  <th className="py-1">{t("patient.colSignificance")}</th>
                </tr>
              </thead>
              <tbody>
                {ANALYTES.map((a) => {
                  const v = mv(a); const st = analyteStatus(a, v); const abn = st === "abnormal" || st === "caution";
                  return (
                    <tr key={a} className="border-b border-gray-50 align-top">
                      <td className="py-1 text-gray-600">{analyteName(t, a)}</td>
                      <td className="num py-1 font-medium text-gray-800">{formatAnalyte(t, a, v)}</td>
                      <td className="py-1 text-gray-400">{normalText(t, a)}</td>
                      <td className="py-1"><span className="font-semibold" style={{ color: STATUS_COLOR[st] }}>{statusLabel(t, st)}</span></td>
                      <td className="py-1 leading-relaxed" style={{ color: abn ? "#7a5230" : "#cbd0d6" }}>{abn ? analyteSignificance(t, a) : t("status.inRange")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* 가이드라인 참고 */}
          {guide && (
            <section className="mb-5">
              <h2 className="mb-2 text-sm font-bold text-ink">{t("patient.guidelineTitle")} · {diseaseLabel(t, top.disease)}</h2>
              <p className="text-sm font-medium text-[#2E5A88]">{guide.reference}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600"><b className="text-gray-500">{t("patient.staging")}</b> · {guide.staging}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-600"><b className="text-gray-500">{t("patient.followup")}</b> · {guide.followup}</p>
            </section>
          )}

          {/* 마이헬스데이터(PHR) */}
          {phr && (
            <section className="mb-5">
              <h2 className="mb-2 text-sm font-bold text-ink">{t("patient.phrTitle")}</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm sm:grid-cols-4">
                {([["glucose", pm("glucose"), "mg/dL"], ["egfr", pm("egfr"), ""], ["bmi", pm("bmi"), ""], ["chol", pm("chol"), ""]] as [string, number | null, string][]).map(([k, v, u]) => (
                  <div key={k} className="flex justify-between border-b border-gray-50 py-0.5"><span className="text-gray-500">{t(`phrMetric.${k}`)}</span><span className="num text-gray-800">{v == null ? "-" : `${v}${u ? " " + u : ""}`}</span></div>
                ))}
              </div>
              {phrS?.med_classes?.length > 0 && <p className="mt-1 text-xs text-gray-600">{t("patient.medClasses", { list: medClassList(t, phrS.med_classes) })}</p>}
              {phrS?.diagnoses?.length > 0 && <p className="text-xs text-gray-600">{t("patient.diagnoses", { list: opinionList(t, phrS.diagnoses) })}</p>}
              {phrF && (
                <p className="text-xs text-gray-600">
                  {t("report.chronicFlags", {
                    list: PHR_FLAG_KEYS.filter((k) => phrF[k]).map((k) => t(`phrFlag.${k}`)).join(", ") || t("common.none"),
                  })}
                </p>
              )}
            </section>
          )}

          {/* 만관제 케어플랜 */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink">{t("patient.carePlanTitle")}</h2>
            <ul className="text-sm text-gray-700">
              {careActions.map((c) => <li key={c.id}>• {careLabel(t, c.action_type)}{c.due_at && ` (${fmtDate(locale, c.due_at)})`}</li>)}
              {careActions.length === 0 && <li className="text-gray-400">{t("patient.noCareAction")}</li>}
            </ul>
            <p className="mt-1 text-xs text-gray-400">{t("report.emrNote")}</p>
          </section>
        </>
      )}

      <p className="border-t border-gray-200 pt-3 text-xs leading-relaxed text-gray-400">
        {t("report.disclaimer")}
      </p>
    </main>
  );
}
