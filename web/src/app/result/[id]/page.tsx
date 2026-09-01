// 결과 상세 = 통합 건강관리 상세보고 (요화학 11항목 + PHR 검진 결합) — SCR_RESULT_DETAIL 확장.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import TrendChart, { type TrendPoint } from "@/components/TrendChart";
import PhrUpload from "@/components/PhrUpload";
import { curateFeed, type CurationContext } from "@/lib/content/curate";
import { GRADE_TOKEN, gradeLabel, careLabel, diseaseLabel } from "@/lib/ui/labels";
import { ANALYTE_META, analyteName, formatAnalyte, analyteStatus, normalText, STATUS_COLOR, statusLabel } from "@/lib/ui/analyte";
import { describeDriver, sourceLabel } from "@/lib/ui/driver";
import { localizeExplanation } from "@/lib/ui/explanation";
import { bpText as fmtBpText, medClassList, phrMetricLabel } from "@/lib/ui/phr";
import { opinionList } from "@/lib/ui/phrOpinion";
import { fmtDate, fmtDateTime, fmtTinyDate } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import type { Analyte } from "@/config/algoParams";

export const dynamic = "force-dynamic";

const ANALYTE_ORDER: Analyte[] = [
  "protein", "glucose", "blood", "leukocyte", "nitrite", "ketone",
  "bilirubin", "urobilinogen", "specific_gravity", "ph", "vitamin_c",
];
const DISEASE_TREND: Record<string, Analyte> = {
  kidney: "protein", diabetes: "glucose", hypertension: "protein", uti: "leukocyte", liver: "bilirubin",
};
/** PHR 플래그 → 메시지 키 (표시 문구는 phrFlag.* 카탈로그) */
const PHR_FLAG_KEYS = ["diabetes", "hypertension", "dyslipidemia", "kidney_watch", "overweight"] as const;

interface ShapItem { analyte: string; feature: string; contribution: number; value?: number }


/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ResultDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessment = await prisma.risk_assessment.findUnique({ where: { id } });
  if (!assessment) notFound();

  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  const [explanation, measurement, careActions, history, measCount, allAssessments, phr] = await Promise.all([
    prisma.explanation.findUnique({ where: { assessment_id: id } }),
    prisma.measurement.findUnique({ where: { id: assessment.measurement_id } }),
    prisma.care_action.findMany({ where: { assessment_id: id }, orderBy: { created_at: "asc" } }),
    prisma.measurement.findMany({ where: { user_id: assessment.user_id }, orderBy: { measured_at: "asc" }, take: 30 }),
    prisma.measurement.count({ where: { user_id: assessment.user_id } }),
    prisma.risk_assessment.findMany({ where: { measurement_id: assessment.measurement_id }, orderBy: { risk_score: "desc" } }),
    prisma.phr_record.findFirst({ where: { user_id: assessment.user_id } }),
  ]);

  const g = GRADE_TOKEN[assessment.risk_grade] ?? GRADE_TOKEN.low;
  const shapTop = (explanation?.shap_values as ShapItem[] | null) ?? [];
  const explained = localizeExplanation(t, explanation);
  const recommendations = explained?.recommendations ?? [];

  const trendAnalyte: Analyte = DISEASE_TREND[assessment.disease] ?? "protein";
  const trend: TrendPoint[] = history
    .map((m) => { const v = (m as any)[trendAnalyte]; return v != null ? { date: m.measured_at.toISOString(), value: Number(v) } : null; })
    .filter((p): p is TrendPoint => p !== null);

  const mv = (a: Analyte): number | null => (measurement ? ((measurement as any)[a] == null ? null : Number((measurement as any)[a])) : null);
  const analyteFlags: Record<string, number> = {};
  for (const a of ANALYTE_ORDER) { const v = mv(a); if (v != null) analyteFlags[a] = v; }
  const ctx: CurationContext = { disease: assessment.disease, risk_grade: assessment.risk_grade, analyte_flags: analyteFlags, first_time: measCount <= 1 };
  const contents = await curateFeed(ctx, 10, locale);

  // PHR
  const phrSummary = phr?.summary as any;
  const phrFlags = phr?.flags as any;
  const pm = (k: string): number | null => phrSummary?.checkups?.[0]?.metrics?.[k]?.num ?? null;
  const bpText = phrSummary?.checkups?.[0]?.metrics?.bp_text ?? null;
  const phrFlagList: string[] = phrFlags
    ? PHR_FLAG_KEYS.filter((k) => phrFlags[k]).map((k) => t(`phrFlag.${k}`))
    : [];
  const phrTrends: any[] = ((phrSummary?.trends ?? []) as any[]).filter((t) => (t.points?.length ?? 0) >= 2);
  const trendWorsening = (t: any): boolean =>
    (t.key === "egfr" && t.direction === "down") ||
    (["glucose", "bmi", "ldl", "tg", "weight", "waist"].includes(t.key) && t.direction === "up");
  const histCols = history.slice(-8); // 최근 8회(현재 포함, 오름차순)

  const bold = { b: (c: React.ReactNode) => <b>{c}</b> };

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-5 flex items-center gap-2">
        <Link href="/dashboard" className="text-sm text-gray-400">← {t("nav.dashboard")}</Link>
        <h1 className="text-xl font-bold text-ink">{t("result.title")}</h1>
        <span className="ml-auto text-xs text-gray-400">{fmtDateTime(locale, assessment.assessed_at)}</span>
      </header>

      {/* 종합 위험 */}
      <section className="rounded-2xl p-6" style={{ background: g.bg }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: g.color }}>{gradeLabel(t, assessment.risk_grade)}</span>
          <span className="text-base font-semibold text-gray-800">
            {t("common.riskOf", { disease: diseaseLabel(t, assessment.disease), score: Number(assessment.risk_score).toFixed(2) })}
            {assessment.standard_grade && ` · ${t("common.standardGrade", { grade: assessment.standard_grade })}`}
          </span>
        </div>
        {explained && <p className="mt-3 text-[15px] leading-relaxed text-gray-800">{explained.text_user}</p>}
        {recommendations.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {recommendations.map((r) => <li key={r} className="rounded-full bg-white/70 px-3 py-1 text-xs text-gray-700">{r}</li>)}
          </ul>
        )}
      </section>

      {/* 질환별 위험 */}
      {allAssessments.length > 1 && (
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("result.byDisease")}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {allAssessments.map((a) => {
              const ag = GRADE_TOKEN[a.risk_grade] ?? GRADE_TOKEN.low;
              const focused = a.id === assessment.id;
              return (
                <Link key={a.id} href={`/result/${a.id}`}
                  className="rounded-xl border p-3 text-center transition hover:bg-gray-50"
                  style={{ borderColor: focused ? ag.color : "#e5e7eb", background: focused ? ag.bg : "#fff" }}>
                  <div className="text-sm text-gray-700">{diseaseLabel(t, a.disease)}</div>
                  <div className="num mt-1 text-lg font-bold" style={{ color: ag.color }}>{Number(a.risk_score).toFixed(2)}</div>
                  <div className="text-[11px] font-semibold" style={{ color: ag.color }}>{gradeLabel(t, a.risk_grade)}</div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* 요화학 11항목 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("result.urinalysis")}</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-400">
              <tr>
                <th className="pb-1.5">{t("result.colItem")}</th>
                <th className="pb-1.5">{t("result.colValue")}</th>
                <th className="pb-1.5">{t("result.colNormal")}</th>
                <th className="pb-1.5 text-right">{t("result.colJudgment")}</th>
              </tr>
            </thead>
            <tbody>
              {ANALYTE_ORDER.map((a) => {
                const v = mv(a);
                const st = analyteStatus(a, v);
                return (
                  <tr key={a} className="border-t border-gray-50">
                    <td className="py-1.5 text-gray-600">{analyteName(t, a)}</td>
                    <td className="num py-1.5 font-medium text-gray-800">{formatAnalyte(t, a, v)}</td>
                    <td className="py-1.5 text-xs text-gray-400">{normalText(t, a)}</td>
                    <td className="py-1.5 text-right">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: STATUS_COLOR[st] }}>{statusLabel(t, st)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* 우측: 추세 + PHR */}
        <div className="space-y-5">
          {(() => {
            const tv = mv(trendAnalyte);
            const tStatus = analyteStatus(trendAnalyte, tv);
            const tColor = STATUS_COLOR[tStatus];
            const tName = analyteName(t, trendAnalyte);
            return (
              <section className="rounded-2xl border border-gray-200 bg-white p-5">
                <TrendChart t={t} data={trend} analyteLabel={tName}
                  color={tColor} normal={ANALYTE_META[trendAnalyte]?.normal} unit={ANALYTE_META[trendAnalyte]?.unit}
                  valueFormat={(v) => formatAnalyte(t, trendAnalyte, v)} />
                <p className="mt-2 text-xs text-gray-600">
                  {t.rich("result.currentUrine", {
                    name: tName,
                    value: formatAnalyte(t, trendAnalyte, tv),
                    b: (c) => <b>{c}</b>,
                    v: (c) => <b style={{ color: tColor }}>{c}</b>,
                  })}
                  <span className="text-gray-400"> · {t("result.normalInline", { normal: normalText(t, trendAnalyte) })}</span>
                  <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: tColor }}>{statusLabel(t, tStatus)}</span>
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                  {t.rich("result.trendNote", {
                    name: tName,
                    disease: diseaseLabel(t, assessment.disease),
                    score: Number(assessment.risk_score).toFixed(2),
                    ...bold,
                  })}
                </p>
              </section>
            );
          })()}

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-700">{t("result.phrTitle")}</h2>
              {phr && <PhrUpload measurementId={assessment.measurement_id} compact />}
            </div>
            {!phr ? (
              <div>
                <p className="mb-3 text-sm text-gray-500">{t.rich("result.phrEmpty", bold)}</p>
                <PhrUpload measurementId={assessment.measurement_id} />
              </div>
            ) : (
              <>
                {phrFlagList.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {phrFlagList.map((l) => <span key={l} className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "#FCEBDD", color: "#d4691b" }}>{l}</span>)}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {([["glucose", pm("glucose"), "mg/dL", "<100"], ["egfr", pm("egfr"), "", "≥90"], ["bmi", pm("bmi"), "", "18.5~24.9"], ["chol", pm("chol"), "", "<200"]] as [string, number | null, string, string][]).map(([k, v, u, ref]) => (
                    <div key={k} className="flex items-baseline justify-between border-b border-gray-50 py-0.5">
                      <span className="text-gray-500">{t(`phrMetric.${k}`)}</span>
                      <span><span className="num font-medium text-gray-800">{v == null ? "-" : `${v}${u ? " " + u : ""}`}</span> <span className="text-[10px] text-gray-300">{t("result.normalInline", { normal: ref })}</span></span>
                    </div>
                  ))}
                  {bpText && <div className="col-span-2 flex justify-between py-0.5 text-sm"><span className="text-gray-500">{t("phrMetric.bp")}</span><span className="num font-medium text-gray-800">{fmtBpText(t, bpText)}</span></div>}
                </div>
                {phrSummary?.med_classes?.length > 0 && <p className="mt-2 text-xs text-gray-500">{t("result.meds", { list: medClassList(t, phrSummary.med_classes) })}</p>}
                {phrSummary?.diagnoses?.length > 0 && <p className="mt-1 text-xs text-gray-500">{t("result.diagnoses", { list: opinionList(t, phrSummary.diagnoses) })}</p>}
              </>
            )}
          </section>
        </div>
      </div>

      {/* 요화학 측정 이력 — 시계열 */}
      {history.length > 1 && (
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">{t("result.historyTitle")}</h2>
          <p className="mb-3 text-xs text-gray-500">
            {t.rich("result.historyNote", {
              n: histCols.length,
              g: (c) => <span style={{ color: "#2E9E5B" }}>{c}</span>,
              o: (c) => <span style={{ color: "#d4691b" }}>{c}</span>,
              s: (c) => <span style={{ color: "#6b7280" }}>{c}</span>,
            })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="sticky left-0 bg-white pb-1.5 pr-3">{t("result.colItem")}</th>
                  {histCols.map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-2 pb-1.5 text-right">
                      {fmtTinyDate(locale, h.measured_at)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ANALYTE_ORDER.map((a) => (
                  <tr key={a} className="border-t border-gray-50">
                    <td className="sticky left-0 whitespace-nowrap bg-white py-1.5 pr-3 text-gray-600">{analyteName(t, a)}</td>
                    {histCols.map((h, i) => {
                      const v = (h as any)[a] == null ? null : Number((h as any)[a]);
                      const st = analyteStatus(a, v);
                      const isLast = i === histCols.length - 1;
                      return (
                        <td key={i} className="num whitespace-nowrap px-2 py-1.5 text-right"
                          style={{ color: STATUS_COLOR[st], fontWeight: isLast ? 700 : 500 }}>
                          {formatAnalyte(t, a, v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 건강검진 추세 — 다년치 시계열 */}
      {phrTrends.length > 0 && (
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">
            {t("result.phrTrendTitle")} {phrSummary?.checkups?.length ? `(${t("result.checkupCount", { n: phrSummary.checkups.length })})` : ""}
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            {t.rich("result.phrTrendNote", { b: (c) => <b className="text-[#d4691b]">{c}</b> })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {phrTrends.map((tr) => {
              const worsening = trendWorsening(tr);
              const color = worsening ? "#d4691b" : "#1a8f84";
              const dirKey = tr.direction === "up" ? "up" : tr.direction === "down" ? "down" : "flat";
              return (
                <div key={tr.key} className="rounded-xl border border-gray-100 p-3">
                  <TrendChart t={t} data={tr.points} analyteLabel={phrMetricLabel(t, tr.key, tr.label)} color={color}
                    normal={tr.normal} unit={tr.unit} />
                  <p className="mt-1 text-[11px]" style={{ color: worsening ? "#d4691b" : "#6b7280" }}>
                    {tr.first} → {tr.last}{tr.unit ? ` ${tr.unit}` : ""} ({tr.delta > 0 ? "+" : ""}{tr.delta}, {t(`trendDir.${dirKey}`)})
                    {worsening && ` · ${t("status.caution")}`}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t("result.phrTrendDisclaimer")}</p>
        </section>
      )}

      {/* 왜 이런 결과인가요? — 일반인 친화 근거 */}
      {shapTop.filter((s) => s.contribution > 0).length > 0 && (() => {
        const drivers = shapTop.filter((s) => s.contribution > 0).slice(0, 5);
        const maxC = Math.max(...drivers.map((s) => s.contribution), 0.01);
        return (
          <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">{t("result.whyTitle")}</h2>
              <span className="rounded-full bg-[#eef5fb] px-2.5 py-1 text-[11px] font-semibold text-[#2E5A88]">
                {assessment.model_version.startsWith("lgbm") ? t("result.engineLgbm") : t("result.engineDefault")}
              </span>
            </div>
            <p className="mb-3 text-sm text-gray-600">
              {t.rich("result.whyNote", { b: (c) => <b className="text-[#d4691b]">{c}</b> })}
            </p>
            <div className="space-y-2">
              {drivers.map((s) => {
                const d = describeDriver(t, s.analyte, s.value, s.feature);
                const pct = Math.min(100, (s.contribution / maxC) * 100);
                const src = d.source === "urine" ? "#2E5A88" : d.source === "phr" ? "#1a8f84" : "#9ca3af";
                const impact = pct >= 66 ? "high" : pct >= 33 ? "mid" : "low";
                return (
                  <div key={s.analyte} className="rounded-xl border p-3" style={{ borderColor: d.isHigh ? "#FAD9C2" : "#eef0f2", background: d.isHigh ? "#FFF8F3" : "#fff" }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: src }}>{sourceLabel(t, d.source)}</span>
                        <span className="text-sm font-semibold text-gray-800">{d.label}</span>
                      </div>
                      <span className="text-sm"><b style={{ color: d.isHigh ? "#d4691b" : "#2E9E5B" }}>{d.valueText}</b> <span className="text-xs text-gray-400">· {t("result.normalInline", { normal: d.normalText })}</span></span>
                    </div>
                    {d.sentence && <p className="mt-1 text-xs leading-relaxed text-gray-600">{d.sentence}</p>}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded bg-gray-100"><div className="h-1.5 rounded" style={{ width: `${pct}%`, background: d.isHigh ? "#d4691b" : "#9ca3af" }} /></div>
                      <span className="text-[10px] text-gray-400">{t("result.impact", { level: t(`result.impactLevel.${impact}`) })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-400">{t("result.whyDisclaimer")}</p>
          </section>
        );
      })()}

      {/* 권장 행동 */}
      {careActions.length > 0 && (
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">{t("result.careTitle")}</h2>
          <ul className="space-y-1 text-sm text-gray-800">
            {careActions.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span>• {careLabel(t, c.action_type)}{c.due_at && ` (${t("result.dueBy", { date: fmtDate(locale, c.due_at) })})`}</span>
                <Link href="/care" className="text-xs font-semibold text-[#2E5A88]">{t("nav.care")} →</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 맞춤 콘텐츠 */}
      {contents.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("common.recommended")}</h2>
          <div className={`grid gap-3 ${contents.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {contents.map((c) => (
              <Link key={c.content_id} href={`/contents/${c.content_id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:shadow-sm">
                <div className="text-sm font-semibold text-gray-800">{c.title}</div>
                {c.body && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-600">{c.body}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-6 rounded-lg bg-gray-100 p-3 text-xs leading-relaxed text-gray-500">
        {t("result.disclaimer")}
        {assessment.is_samd_output && <><br />{t("result.samdNote", { model: assessment.model_version })}</>}
      </p>
    </main>
  );
}
