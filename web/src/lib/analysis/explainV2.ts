// 다질환 설명 생성 — 이중채널(사용자/의료진) + 권고 + 안전고지.
// 규제: 진단·치료·효능 단정 금지, 선별 한계 명시.
import { ALGO_PARAMS } from "@/config/algoParams";
import { scoreToGrade, type DiseaseResult, type Grade } from "./engine";

const EXP = ALGO_PARAMS.explanation;

// 안전고지 토큰 (콘텐츠원고집 안전 C-SAFE / 세부데이터 D.6)
const SAFE = {
  SCREENING: "본 정보는 건강관리를 돕기 위한 선별 정보이며, 의료적 진단이 아닙니다.",
  RECHECK: "한 번의 결과보다 여러 번의 추세가 중요합니다. 재측정을 권장합니다.",
  CONSULT: "증상이 지속되거나 우려되면 의료진과 상담하세요.",
  EMERGENCY: "위험 신호가 뚜렷하게 나타났어요. 의료진과 상담해 보시길 권합니다.",
  NOT_DX: "이 결과만으로 질환을 진단하지 않습니다.",
  PRIVACY: "건강정보는 분리·보호되며, 본인 동의 범위에서만 활용됩니다.",
  VITC: "비타민C 섭취는 일부 항목(잠혈·요당)의 반응을 낮출 수 있어 보정에 반영했습니다.",
};

function safetyFor(g: Grade, vitc = false): string {
  const base =
    g === "very_high" ? `${SAFE.EMERGENCY} ${SAFE.NOT_DX}`
    : g === "high" ? `${SAFE.NOT_DX} ${SAFE.CONSULT}`
    : g === "moderate" ? `${SAFE.SCREENING} ${SAFE.RECHECK}`
    : `${SAFE.SCREENING} ${SAFE.PRIVACY}`;
  return vitc ? `${base} ${SAFE.VITC}` : base;
}

const USER_TONE: Record<Grade, string> = {
  low: "현재 두드러진 위험 신호는 보이지 않아요.",
  moderate: "평소보다 살펴볼 신호가 있어요. 며칠 뒤 재측정해 추세를 확인해 보세요.",
  high: "주의가 필요한 수준이에요. 가까운 시일에 재측정하고 의료진과 상의해 보시길 권해요.",
  very_high: "위험 신호가 뚜렷하게 나타났어요. 의료진과 상담해 보시길 권해요.",
};

const REC_BY_DISEASE: Record<string, string[]> = {
  kidney: ["충분한 수분 섭취", "짠 음식 줄이기", "혈압·혈당 관리", "단백뇨 지속 시 신기능 평가 상담"],
  diabetes: ["공복 혈당 확인", "정제 탄수화물·단 음료 줄이기", "식후 가벼운 활동", "반복 시 혈당 검사 상담"],
  hypertension: ["저염식·체중 관리", "규칙적 혈압 기록", "혈압이 잘 조절되지 않으면 상담"],
  uti: ["충분한 수분 섭취", "배뇨를 오래 참지 않기", "배뇨통·빈뇨 등 증상 시 의료진 상담"],
  liver: ["과음 피하기", "지속 시 간기능 혈액검사 상담"],
};

export interface Explanation {
  shap_top: { analyte: string; feature: string; contribution: number; value?: number; direction: "increase" }[];
  text_user: string;
  text_clinician: string;
  recommendations: string[];
  counterfactual: { if: string; then_grade: Grade }[];
  safety_notice: string;
}

export function explainDisease(r: DiseaseResult, opts?: { vitcDisturbance?: boolean }): Explanation {
  const positive = r.contributions.filter((c) => c.contribution > 0);
  const clinicianTop = positive.slice(0, EXP.top_k);        // 의료진: 최대 top_k(5)
  const userTop = positive.slice(0, EXP.user_visible_k);    // 사용자: user_visible_k(3)
  const topLabels = userTop.map((c) => c.label).join(", ");

  const text_user =
    r.risk_grade === "low"
      ? `${r.label}: ${USER_TONE.low}`
      : `${r.label} 관련 신호(${topLabels})가 확인됐어요. ${USER_TONE[r.risk_grade]}`;

  const text_clinician =
    `${r.label} 위험 ${r.risk_score.toFixed(2)} (${r.risk_grade})` +
    (r.standard_grade ? ` · 표준등급 ${r.standard_grade}` : "") +
    `. 주요 기여: ${clinicianTop.map((c) => `${c.label}(${c.contribution.toFixed(2)})`).join(", ") || "없음"}` +
    `. 선별 분석 결과로 진단·처방을 대체하지 않음.`;

  // 반사실: 상위 기여 요인을 순차 제거하며 목표등급(low) 도달까지 최대 counterfactual_max건
  const counterfactual: Explanation["counterfactual"] = [];
  let cfScore = r.risk_score;
  for (const c of clinicianTop) {
    if (counterfactual.length >= EXP.counterfactual_max) break;
    cfScore = Math.max(0, cfScore - c.contribution);
    const g = scoreToGrade(cfScore);
    counterfactual.push({ if: `${c.label}이(가) 개선되면`, then_grade: g });
    if (g === EXP.counterfactual_target) break; // 목표등급 도달 시 종료
  }

  return {
    shap_top: clinicianTop.map((c) => ({ analyte: c.feature, feature: c.label, contribution: c.contribution, value: c.value, direction: "increase" as const })),
    text_user,
    text_clinician,
    recommendations: r.risk_grade === "low" ? [] : REC_BY_DISEASE[r.disease] ?? [],
    counterfactual,
    safety_notice: safetyFor(r.risk_grade, opts?.vitcDisturbance),
  };
}
