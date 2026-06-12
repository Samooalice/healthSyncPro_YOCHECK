// 결과 상세 = 통합 건강관리 상세보고 (요화학 11항목 + PHR 검진 결합) — SCR_RESULT_DETAIL 확장.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import TrendChart, { type TrendPoint } from "@/components/TrendChart";
import PhrUpload from "@/components/PhrUpload";
import { curateFeed, type CurationContext } from "@/lib/content/curate";
import { GRADE_TOKEN, ANALYTE_KO, CARE_KO, DISEASE_KO } from "@/lib/ui/labels";
import { ANALYTE_META, formatAnalyte, analyteStatus, normalText, STATUS_COLOR, STATUS_LABEL } from "@/lib/ui/analyte";
import { describeDriver } from "@/lib/ui/driver";
import type { Analyte } from "@/config/algoParams";

export const dynamic = "force-dynamic";

const ANALYTE_ORDER: Analyte[] = [
  "protein", "glucose", "blood", "leukocyte", "nitrite", "ketone",
  "bilirubin", "urobilinogen", "specific_gravity", "ph", "vitamin_c",
];
const DISEASE_TREND: Record<string, Analyte> = {
  kidney: "protein", diabetes: "glucose", hypertension: "protein", uti: "leukocyte", liver: "bilirubin",
};

interface ShapItem { analyte: string; feature: string; contribution: number; value?: number }

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ResultDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessment = await prisma.risk_assessment.findUnique({ where: { id } });
  if (!assessment) notFound();

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
  const cf = (explanation?.counterfactual ?? {}) as { recommendations?: string[] };
  const recommendations = cf.recommendations ?? [];

  const trendAnalyte: Analyte = DISEASE_TREND[assessment.disease] ?? "protein";
  const trend: TrendPoint[] = history
    .map((m) => { const v = (m as any)[trendAnalyte]; return v != null ? { date: m.measured_at.toISOString(), value: Number(v) } : null; })
    .filter((p): p is TrendPoint => p !== null);

  const mv = (a: Analyte): number | null => (measurement ? ((measurement as any)[a] == null ? null : Number((measurement as any)[a])) : null);
  const analyteFlags: Record<string, number> = {};
  for (const a of ANALYTE_ORDER) { const v = mv(a); if (v != null) analyteFlags[a] = v; }
  const ctx: CurationContext = { disease: assessment.disease, risk_grade: assessment.risk_grade, analyte_flags: analyteFlags, first_time: measCount <= 1 };
  const contents = await curateFeed(ctx);

  // PHR
  const phrSummary = phr?.summary as any;
  const phrFlags = phr?.flags as any;
  const pm = (k: string): number | null => phrSummary?.checkups?.[0]?.metrics?.[k]?.num ?? null;
  const bpText = phrSummary?.checkups?.[0]?.metrics?.bp_text ?? null;
  const phrFlagList: string[] = phrFlags
    ? ([["당뇨", phrFlags.diabetes], ["고혈압", phrFlags.hypertension], ["이상지질혈증", phrFlags.dyslipidemia], ["신장주의", phrFlags.kidney_watch], ["과체중", phrFlags.overweight]] as [string, boolean][])
        .filter(([, v]) => v).map(([l]) => l) : [];
  const phrTrends: any[] = ((phrSummary?.trends ?? []) as any[]).filter((t) => (t.points?.length ?? 0) >= 2);
  const trendWorsening = (t: any): boolean =>
    (t.key === "egfr" && t.direction === "down") ||
    (["glucose", "bmi", "ldl", "tg", "weight", "waist"].includes(t.key) && t.direction === "up");
  const histCols = history.slice(-8); // 최근 8회(현재 포함, 오름차순)

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-5 flex items-center gap-2">
        <Link href="/dashboard" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="text-xl font-bold text-ink">통합 건강관리 상세보고</h1>
        <span className="ml-auto text-xs text-gray-400">{new Date(assessment.assessed_at).toLocaleString("ko-KR", { hour12: false })}</span>
      </header>

      {/* 종합 위험 */}
      <section className="rounded-2xl p-6" style={{ background: g.bg }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: g.color }}>{g.label}</span>
          <span className="text-base font-semibold text-gray-800">
            {DISEASE_KO[assessment.disease] ?? assessment.disease} 위험 {Number(assessment.risk_score).toFixed(2)}
            {assessment.standard_grade && ` · KDIGO형 ${assessment.standard_grade}`}
          </span>
        </div>
        {explanation && <p className="mt-3 text-[15px] leading-relaxed text-gray-800">{explanation.text_user}</p>}
        {recommendations.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {recommendations.map((r) => <li key={r} className="rounded-full bg-white/70 px-3 py-1 text-xs text-gray-700">{r}</li>)}
          </ul>
        )}
      </section>

      {/* 질환별 위험 */}
      {allAssessments.length > 1 && (
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">질환별 위험</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {allAssessments.map((a) => {
              const ag = GRADE_TOKEN[a.risk_grade] ?? GRADE_TOKEN.low;
              const focused = a.id === assessment.id;
              return (
                <Link key={a.id} href={`/result/${a.id}`}
                  className="rounded-xl border p-3 text-center transition hover:bg-gray-50"
                  style={{ borderColor: focused ? ag.color : "#e5e7eb", background: focused ? ag.bg : "#fff" }}>
                  <div className="text-sm text-gray-700">{DISEASE_KO[a.disease] ?? a.disease}</div>
                  <div className="num mt-1 text-lg font-bold" style={{ color: ag.color }}>{Number(a.risk_score).toFixed(2)}</div>
                  <div className="text-[11px] font-semibold" style={{ color: ag.color }}>{ag.label}</div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* 요화학 11항목 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">요화학 검사 (11항목)</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-400">
              <tr><th className="pb-1.5">항목</th><th className="pb-1.5">측정값</th><th className="pb-1.5">정상범위</th><th className="pb-1.5 text-right">판정</th></tr>
            </thead>
            <tbody>
              {ANALYTE_ORDER.map((a) => {
                const v = mv(a);
                const st = analyteStatus(a, v);
                return (
                  <tr key={a} className="border-t border-gray-50">
                    <td className="py-1.5 text-gray-600">{ANALYTE_META[a]?.name ?? ANALYTE_KO[a] ?? a}</td>
                    <td className="num py-1.5 font-medium text-gray-800">{formatAnalyte(a, v)}</td>
                    <td className="py-1.5 text-xs text-gray-400">{normalText(a)}</td>
                    <td className="py-1.5 text-right">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: STATUS_COLOR[st] }}>{STATUS_LABEL[st]}</span>
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
            return (
              <section className="rounded-2xl border border-gray-200 bg-white p-5">
                <TrendChart data={trend} analyteLabel={ANALYTE_META[trendAnalyte]?.name ?? ANALYTE_KO[trendAnalyte] ?? trendAnalyte}
                  color={tColor} normal={ANALYTE_META[trendAnalyte]?.normal} unit={ANALYTE_META[trendAnalyte]?.unit}
                  valueFormat={(v) => formatAnalyte(trendAnalyte, v)} />
                <p className="mt-2 text-xs text-gray-600">
                  현재 소변 <b>{ANALYTE_META[trendAnalyte]?.name ?? trendAnalyte}</b>: <b style={{ color: tColor }}>{formatAnalyte(trendAnalyte, tv)}</b>
                  <span className="text-gray-400"> · 정상 {normalText(trendAnalyte)}</span>
                  <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: tColor }}>{STATUS_LABEL[tStatus]}</span>
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400">※ 이 그래프는 <b>소변 {ANALYTE_META[trendAnalyte]?.name ?? trendAnalyte}</b> 한 항목이에요(정상이면 초록). {DISEASE_KO[assessment.disease] ?? assessment.disease} 위험({Number(assessment.risk_score).toFixed(2)})은 소변과 건강검진을 함께 본 값이라, 이 항목이 정상이어도 다른 요인 때문에 위험할 수 있어요.</p>
              </section>
            );
          })()}

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-700">건강검진 데이터 (마이헬스데이터)</h2>
              {phr && <PhrUpload measurementId={assessment.measurement_id} compact />}
            </div>
            {!phr ? (
              <div>
                <p className="mb-3 text-sm text-gray-500">아직 건강검진(PHR) 데이터가 없어요. 나의건강기록을 연동하면 요화학 결과와 합쳐 <b>종합 건강 보고서</b>가 만들어져요.</p>
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
                  {([["공복혈당", pm("glucose"), "mg/dL", "<100"], ["eGFR", pm("egfr"), "", "≥90"], ["BMI", pm("bmi"), "", "18.5~24.9"], ["총콜레스테롤", pm("chol"), "", "<200"]] as [string, number | null, string, string][]).map(([l, v, u, ref]) => (
                    <div key={l} className="flex items-baseline justify-between border-b border-gray-50 py-0.5">
                      <span className="text-gray-500">{l}</span>
                      <span><span className="num font-medium text-gray-800">{v == null ? "-" : `${v}${u ? " " + u : ""}`}</span> <span className="text-[10px] text-gray-300">정상 {ref}</span></span>
                    </div>
                  ))}
                  {bpText && <div className="col-span-2 flex justify-between py-0.5 text-sm"><span className="text-gray-500">혈압</span><span className="num font-medium text-gray-800">{bpText}</span></div>}
                </div>
                {phrSummary?.med_classes?.length > 0 && <p className="mt-2 text-xs text-gray-500">복약: {phrSummary.med_classes.join(", ")}</p>}
                {phrSummary?.diagnoses?.length > 0 && <p className="mt-1 text-xs text-gray-500">진단: {phrSummary.diagnoses.join(" · ")}</p>}
              </>
            )}
          </section>
        </div>
      </div>

      {/* 요화학 측정 이력 — 시계열 */}
      {history.length > 1 && (
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">요화학 측정 이력</h2>
          <p className="mb-3 text-xs text-gray-500">최근 {histCols.length}회 측정의 항목별 변화예요. 색은 판정(<span style={{ color: "#2E9E5B" }}>초록 정상</span>·<span style={{ color: "#d4691b" }}>주황 이상</span>·<span style={{ color: "#6b7280" }}>회색 참고</span>)을, 가장 오른쪽 굵은 값이 이번 측정이에요.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="sticky left-0 bg-white pb-1.5 pr-3">항목</th>
                  {histCols.map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-2 pb-1.5 text-right">
                      {new Date(h.measured_at).toLocaleDateString("ko-KR", { year: "2-digit", month: "numeric", day: "numeric" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ANALYTE_ORDER.map((a) => (
                  <tr key={a} className="border-t border-gray-50">
                    <td className="sticky left-0 whitespace-nowrap bg-white py-1.5 pr-3 text-gray-600">{ANALYTE_META[a]?.name ?? ANALYTE_KO[a] ?? a}</td>
                    {histCols.map((h, i) => {
                      const v = (h as any)[a] == null ? null : Number((h as any)[a]);
                      const st = analyteStatus(a, v);
                      const isLast = i === histCols.length - 1;
                      return (
                        <td key={i} className="num whitespace-nowrap px-2 py-1.5 text-right"
                          style={{ color: STATUS_COLOR[st], fontWeight: isLast ? 700 : 500 }}>
                          {formatAnalyte(a, v)}
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
          <h2 className="mb-1 text-sm font-semibold text-gray-700">건강검진 추세 {phrSummary?.checkups?.length ? `(${phrSummary.checkups.length}회 검진)` : ""}</h2>
          <p className="mb-4 text-xs text-gray-500">건강검진 수치의 시간에 따른 변화예요. 현재값이 정상이어도 <b className="text-[#d4691b]">악화 추세</b>(예: eGFR 하락·공복혈당 상승)면 미리 살펴볼 가치가 있어요.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {phrTrends.map((t) => {
              const worsening = trendWorsening(t);
              const color = worsening ? "#d4691b" : "#1a8f84";
              const dirKo = t.direction === "up" ? "상승" : t.direction === "down" ? "하락" : "유지";
              return (
                <div key={t.key} className="rounded-xl border border-gray-100 p-3">
                  <TrendChart data={t.points} analyteLabel={t.label} color={color}
                    normal={t.normal} unit={t.unit} />
                  <p className="mt-1 text-[11px]" style={{ color: worsening ? "#d4691b" : "#6b7280" }}>
                    {t.first} → {t.last}{t.unit ? ` ${t.unit}` : ""} ({t.delta > 0 ? "+" : ""}{t.delta}, {dirKo})
                    {worsening && " · 주의"}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-gray-400">※ 검진 추세는 참고용이며 진단이 아니에요. eGFR 하락·공복혈당 상승 등 악화 추세는 다음 진료 때 의료진과 함께 확인하세요.</p>
        </section>
      )}

      {/* 왜 이런 결과인가요? — 일반인 친화 근거 */}
      {shapTop.filter((s) => s.contribution > 0).length > 0 && (() => {
        const drivers = shapTop.filter((s) => s.contribution > 0).slice(0, 5);
        const maxC = Math.max(...drivers.map((s) => s.contribution), 0.01);
        return (
          <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">왜 이런 결과인가요?</h2>
              <span className="rounded-full bg-[#eef5fb] px-2.5 py-1 text-[11px] font-semibold text-[#2E5A88]">
                {assessment.model_version.startsWith("lgbm") ? "AI 분석(LightGBM)" : "분석 엔진"}
              </span>
            </div>
            <p className="mb-3 text-sm text-gray-600">아래 요인들이 이번 위험 판정에 영향을 줬어요. <b className="text-[#d4691b]">주황색</b>은 위험을 높인 요인이에요.</p>
            <div className="space-y-2">
              {drivers.map((s) => {
                const d = describeDriver(s.analyte, s.value, s.feature);
                const pct = Math.min(100, (s.contribution / maxC) * 100);
                const src = d.source === "소변검사" ? "#2E5A88" : d.source === "건강검진" ? "#1a8f84" : "#9ca3af";
                return (
                  <div key={s.analyte} className="rounded-xl border p-3" style={{ borderColor: d.isHigh ? "#FAD9C2" : "#eef0f2", background: d.isHigh ? "#FFF8F3" : "#fff" }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: src }}>{d.source}</span>
                        <span className="text-sm font-semibold text-gray-800">{d.label}</span>
                      </div>
                      <span className="text-sm"><b style={{ color: d.isHigh ? "#d4691b" : "#2E9E5B" }}>{d.valueText}</b> <span className="text-xs text-gray-400">· 정상 {d.normalText}</span></span>
                    </div>
                    {d.sentence && <p className="mt-1 text-xs leading-relaxed text-gray-600">{d.sentence}</p>}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded bg-gray-100"><div className="h-1.5 rounded" style={{ width: `${pct}%`, background: d.isHigh ? "#d4691b" : "#9ca3af" }} /></div>
                      <span className="text-[10px] text-gray-400">영향 {pct >= 66 ? "높음" : pct >= 33 ? "중간" : "낮음"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-400">※ 위험도는 소변검사와 건강검진(PHR)을 함께 분석한 결과예요. 소변 한 항목이 정상이어도, 건강검진 기록 때문에 위험이 높게 평가될 수 있어요.</p>
          </section>
        );
      })()}

      {/* 권장 행동 */}
      {careActions.length > 0 && (
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">권장 행동</h2>
          <ul className="space-y-1 text-sm text-gray-800">
            {careActions.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span>• {CARE_KO[c.action_type] ?? c.action_type}{c.due_at && ` (기한 ${new Date(c.due_at).toLocaleDateString("ko-KR")})`}</span>
                <Link href="/care" className="text-xs font-semibold text-[#2E5A88]">케어 →</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 맞춤 콘텐츠 */}
      {contents.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">맞춤 콘텐츠</h2>
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
        본 보고는 요화학 검사와 건강검진(PHR)을 결합한 선별 정보이며, 의료적 진단이 아닙니다. 증상이 지속되거나 우려되면 의료진과 상담하세요.
        {assessment.is_samd_output && <><br />위험계층화·등급 산출은 의료기기(SaMD) 인허가를 전제로 하는 기능입니다. (모델 {assessment.model_version})</>}
      </p>
    </main>
  );
}
