// 다질환 설명 생성 — 이중채널(사용자/의료진) + 권고 + 안전고지.
// 규제: 진단·치료·효능 단정 금지, 선별 한계 명시.
//
// 다국어: 설명문은 DB(care.explanation)에 저장되는 "생성 콘텐츠"다.
// 저장 시점에 문장을 확정해 버리면 나중에 언어를 바꿔도 그 문장은 한국어로 남는다.
// 그래서 여기서는 **문장 대신 스펙(키 + 파라미터)** 을 만들고(buildExplanationSpec),
// 화면에서 현재 언어로 렌더링한다(renderExplanation).
// 파이프라인은 스펙을 그대로 저장하면서, 감사·API 하위호환을 위해 기준어(ko) 렌더링 결과도
// text_user/text_clinician 컬럼에 함께 남긴다.
import { ALGO_PARAMS } from "@/config/algoParams";
import { scoreToGrade, type DiseaseResult, type Grade } from "./engine";
import type { Translate } from "@/i18n/t";

const EXP = ALGO_PARAMS.explanation;

/** 질환별 권고 항목 키 (문구는 rec.<disease>.<key>) */
const REC_BY_DISEASE: Record<string, string[]> = {
  kidney: ["hydration", "less_salt", "bp_glucose", "kidney_eval"],
  diabetes: ["fasting_glucose", "less_carb", "walk_after_meal", "glucose_test"],
  hypertension: ["low_salt_weight", "bp_log", "consult_uncontrolled"],
  uti: ["hydration", "no_holding", "consult_symptoms"],
  liver: ["avoid_alcohol", "liver_test"],
};

/** 등급별 안전고지 토큰 조합 (콘텐츠원고집 안전 C-SAFE / 세부데이터 D.6) */
const SAFETY_BY_GRADE: Record<Grade, string[]> = {
  very_high: ["emergency", "notDx"],
  high: ["notDx", "consult"],
  moderate: ["screening", "recheck"],
  low: ["screening", "privacy"],
};

export interface ExplanationSpec {
  /** 스펙 버전 — 렌더러 호환 판정용 */
  v: 1;
  disease: string;
  grade: Grade;
  score: number;
  standard_grade: string | null;
  /** 사용자에게 보여줄 상위 기여 요인 */
  userTop: { key: string; label?: string }[];
  /** 의료진용 상위 기여 요인 */
  clinicianTop: { key: string; label?: string; contribution: number; value?: number }[];
  /** 권고 항목 키 */
  recommendations: string[];
  counterfactual: { key: string; label?: string; then_grade: Grade }[];
  /** 비타민C 교란 보정 여부 */
  vitc: boolean;
}

export interface Explanation {
  shap_top: { analyte: string; feature: string; contribution: number; value?: number; direction: "increase" }[];
  text_user: string;
  text_clinician: string;
  recommendations: string[];
  counterfactual: { if: string; then_grade: Grade }[];
  safety_notice: string;
}

/** 분석 결과 → 언어 중립 설명 스펙. */
export function buildExplanationSpec(r: DiseaseResult, opts?: { vitcDisturbance?: boolean }): ExplanationSpec {
  const positive = r.contributions.filter((c) => c.contribution > 0);
  const clinicianTop = positive.slice(0, EXP.top_k);        // 의료진: 최대 top_k(5)
  const userTop = positive.slice(0, EXP.user_visible_k);    // 사용자: user_visible_k(3)

  // 반사실: 상위 기여 요인을 순차 제거하며 목표등급(low) 도달까지 최대 counterfactual_max건
  const counterfactual: ExplanationSpec["counterfactual"] = [];
  let cfScore = r.risk_score;
  for (const c of clinicianTop) {
    if (counterfactual.length >= EXP.counterfactual_max) break;
    cfScore = Math.max(0, cfScore - c.contribution);
    const g = scoreToGrade(cfScore);
    counterfactual.push({ key: c.feature, label: c.label, then_grade: g });
    if (g === EXP.counterfactual_target) break; // 목표등급 도달 시 종료
  }

  return {
    v: 1,
    disease: r.disease,
    grade: r.risk_grade,
    score: r.risk_score,
    standard_grade: r.standard_grade,
    userTop: userTop.map((c) => ({ key: c.feature, label: c.label })),
    clinicianTop: clinicianTop.map((c) => ({ key: c.feature, label: c.label, contribution: c.contribution, value: c.value })),
    recommendations: r.risk_grade === "low" ? [] : REC_BY_DISEASE[r.disease] ?? [],
    counterfactual,
    vitc: !!opts?.vitcDisturbance,
  };
}

/** 피처 라벨 — 카탈로그에 없으면 ML 서비스가 준 라벨, 그것도 없으면 키를 그대로. */
export function featureLabel(t: Translate, key: string, fallback?: string): string {
  const s = t(`feature.${key}`);
  return s === `feature.${key}` ? fallback ?? key : s;
}

/** 질환 정식 명칭 (diseaseFull.*) — 없으면 짧은 명칭(disease.*)으로 폴백. */
export function diseaseFullLabel(t: Translate, disease: string): string {
  const full = t(`diseaseFull.${disease}`);
  if (full !== `diseaseFull.${disease}`) return full;
  const short = t(`disease.${disease}`);
  return short === `disease.${disease}` ? disease : short;
}

function safetyNotice(t: Translate, grade: Grade, vitc: boolean): string {
  const parts = SAFETY_BY_GRADE[grade].map((k) => t(`safety.${k}`));
  if (vitc) parts.push(t("safety.vitc"));
  return parts.join(" ");
}

/** 스펙 + 현재 언어 → 화면에 그릴 문장들. */
export function renderExplanation(t: Translate, spec: ExplanationSpec): Explanation {
  const disease = diseaseFullLabel(t, spec.disease);
  const userLabels = spec.userTop.map((c) => featureLabel(t, c.key, c.label)).join(", ");
  const tone = t(`explain.tone.${spec.grade}`);

  const text_user =
    spec.grade === "low"
      ? t("explain.userLow", { disease, tone })
      : t("explain.userSignals", { disease, labels: userLabels, tone });

  const contrib = spec.clinicianTop
    .map((c) => `${featureLabel(t, c.key, c.label)}(${c.contribution.toFixed(2)})`)
    .join(", ") || t("common.none");

  const text_clinician = spec.standard_grade
    ? t("explain.clinicianStd", {
        disease, score: spec.score.toFixed(2), grade: spec.grade,
        standard: spec.standard_grade, contrib,
      })
    : t("explain.clinician", {
        disease, score: spec.score.toFixed(2), grade: spec.grade, contrib,
      });

  return {
    shap_top: spec.clinicianTop.map((c) => ({
      analyte: c.key,
      feature: featureLabel(t, c.key, c.label),
      contribution: c.contribution,
      value: c.value,
      direction: "increase" as const,
    })),
    text_user,
    text_clinician,
    recommendations: spec.recommendations.map((k) => t(`rec.${spec.disease}.${k}`)),
    counterfactual: spec.counterfactual.map((c) => ({
      if: t("explain.ifImproved", { label: featureLabel(t, c.key, c.label) }),
      then_grade: c.then_grade,
    })),
    safety_notice: safetyNotice(t, spec.grade, spec.vitc),
  };
}
