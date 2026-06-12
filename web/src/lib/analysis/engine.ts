// 다질환 하이브리드 분석 엔진 (Phase 0/1) — 요화학 + 시계열 + 임상룰 + PHR 결합.
// 출처: sdc_deploy 1.doc "소변검사_AI분석_개발방안" (M-CKD/DM/HTN/UTI/LIV, 도메인 피처, 룰엔진 부록B).
// 무거운 ML(LightGBM/SHAP)은 Step 3c에서 이 인터페이스 뒤로 교체.
import { ALGO_PARAMS, type Analyte } from "@/config/algoParams";
import type { RawValues } from "./correction";
import type { PhrFlags } from "@/lib/phr/ingest";

export type Grade = "low" | "moderate" | "high" | "very_high";

// 위험도 등급 컷오프는 단일 소스(algoParams.grade_thresholds = 세부데이터 B.4.2: 0.25/0.50/0.75)에서 가져온다.
const GT = ALGO_PARAMS.grade_thresholds;
export function scoreToGrade(s: number): Grade {
  if (s < GT.moderate[0]) return "low";        // < 0.25
  if (s < GT.high[0]) return "moderate";        // < 0.50
  if (s < GT.very_high[0]) return "high";       // < 0.75
  return "very_high";
}

const lv = (raw: RawValues, a: Analyte) => Number(raw[a] ?? 0);
const sev = (level: number, max = 4) => Math.min(1, Math.max(0, level) / max);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ── 도메인 파생 피처 + 시계열 (개발방안 5.2~5.3) ──
export interface Features {
  uti_flag: boolean;
  dka_flag: boolean;
  nephritis_flag: boolean;
  dehydration_flag: boolean;
  vitc_disturbance: boolean;
  pos_burden: number; // 양성 항목 수
  protein_consec_pos: number; // 연속 단백 양성 횟수(현재 포함)
  protein_trend_slope: number; // 최근 단백 회귀 기울기
  n_exams: number;
}

function consecutivePos(series: number[], thresh = 1): number {
  let c = 0;
  for (let i = series.length - 1; i >= 0; i--) { if (series[i] >= thresh) c++; else break; }
  return c;
}
function slope(series: number[]): number {
  const n = series.length;
  if (n < 2) return 0;
  const xs = series.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = series.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (series[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : 0;
}

/** 현재 측정 + 이력(오래된→최신, 현재 포함)으로 피처 산출. */
export function computeFeatures(raw: RawValues, history: RawValues[]): Features {
  const series = history.map((h) => Number(h.protein ?? 0));
  const glu = lv(raw, "glucose"), ket = lv(raw, "ketone"), pro = lv(raw, "protein"),
    blood = lv(raw, "blood"), leu = lv(raw, "leukocyte"), nit = lv(raw, "nitrite"),
    sg = Number(raw.specific_gravity ?? 1.015), vitc = lv(raw, "vitamin_c"), bil = lv(raw, "bilirubin");
  const semi: Analyte[] = ["glucose", "protein", "blood", "leukocyte", "nitrite", "ketone", "bilirubin"];

  return {
    uti_flag: leu >= 2 && nit >= 1,
    dka_flag: glu >= 3 && ket >= 2,
    nephritis_flag: pro >= 2 && blood >= 2,
    dehydration_flag: sg >= 1.025 && ket >= 1,
    vitc_disturbance: vitc >= 2,
    pos_burden: semi.filter((a) => lv(raw, a) >= 1).length + (bil >= 1 ? 0 : 0),
    protein_consec_pos: consecutivePos(series, 2), // 1+(코드2) 이상 연속
    protein_trend_slope: slope(series.slice(-6)),
    n_exams: history.length,
  };
}

// PHR 검진수치 → 심각도
const glucoseSev = (g: number | null) => (g == null ? 0 : g >= 126 ? 1 : g >= 100 ? 0.55 : 0);
const egfrSev = (e: number | null) => (e == null ? 0 : e < 45 ? 1 : e < 60 ? 0.7 : e < 90 ? 0.35 : 0);

export interface Contribution { feature: string; label: string; contribution: number; value?: number }
export interface DiseaseResult {
  disease: string;
  label: string;
  risk_score: number;
  risk_grade: Grade;
  standard_grade: string | null;
  contributions: Contribution[];
  is_samd_output: boolean;
}

const DISEASE_LABEL: Record<string, string> = {
  kidney: "만성신장질환", diabetes: "당뇨", hypertension: "고혈압", uti: "요로감염", liver: "간담도",
};

function pack(disease: string, parts: [string, string, number][], boosts: [string, string, number][], extra?: { standard?: string }): DiseaseResult {
  const contributions: Contribution[] = [];
  let score = 0;
  for (const [feature, label, c] of [...parts, ...boosts]) {
    if (c <= 0) continue;
    score += c;
    contributions.push({ feature, label, contribution: Number(c.toFixed(3)) });
  }
  score = clamp01(score);
  contributions.sort((a, b) => b.contribution - a.contribution);
  return {
    disease, label: DISEASE_LABEL[disease] ?? disease,
    risk_score: Number(score.toFixed(4)), risk_grade: scoreToGrade(score),
    standard_grade: extra?.standard ?? null, contributions, is_samd_output: true,
  };
}

// ── 질환별 스코어러 (요화학 + 시계열 + 룰 + PHR) ──
const KDIGO_A: Record<number, string> = { 0: "A1", 1: "A2", 2: "A3", 3: "A3", 4: "A3" };

// P1 개인화 신호 (baseline 모듈에서 산출). 미제공 시 룰 기반과 동일하게 동작.
export interface PersonalSignals {
  proteinDevSd?: number;      // 개인 기준선 대비 요단백 편차(SD)
  proteinPersistent?: boolean; // 개인 임계 초과가 연속(지속성) 충족
}

export function analyzeAll(corrected: RawValues, raw: RawValues, f: Features, phr: PhrFlags | null, personal?: PersonalSignals): DiseaseResult[] {
  const c = (a: Analyte) => sev(lv(corrected, a));
  const CD = ALGO_PARAMS.change_detection;
  const DW = ALGO_PARAMS.disease_weights;
  const out: DiseaseResult[] = [];

  // M-CKD (신장)
  {
    // 개인 기준선 대비 단백 상승(P1) — disease_weights.kidney.protein_dev 가중, 개인임계(k·SD) 초과분만 반영
    const devSd = personal?.proteinDevSd ?? 0;
    const personalProteinDev = devSd > CD.k ? clamp01((devSd - CD.k) / 4) * (DW.kidney?.protein_dev ?? 0.45) * 0.5 : 0;
    // 지속성: P1 detectChange 결과 우선, 없으면 시계열 연속양성으로 대체
    const persistent = personal?.proteinPersistent ?? (f.protein_consec_pos >= 2);
    const parts: [string, string, number][] = [
      ["protein_dev", "요단백", c("protein") * 0.3],
      ["blood_dev", "잠혈", c("blood") * 0.15],
      ["leukocyte_dev", "백혈구", c("leukocyte") * 0.05],
    ];
    const boosts: [string, string, number][] = [
      ["protein_personal_dev", "개인 기준선 대비 단백 상승", personalProteinDev],
      ["protein_persistence", "단백뇨 지속", persistent ? 0.12 : 0],
      ["nephritis_rule", "단백+잠혈(사구체신염 시사)", f.nephritis_flag ? 0.1 : 0],
      ["phr_egfr", "검진 eGFR 저하", egfrSev(phr?.egfr ?? null) * 0.2],
      ["phr_egfr_trend", "검진 eGFR 하락 추세", (phr?.egfr_slope ?? 0) < -3 ? clamp01(-(phr?.egfr_slope ?? 0) / 15) * 0.12 : 0],
      ["phr_kidney_watch", "검진 신장 주의소견", phr?.kidney_watch ? 0.1 : 0],
      ["phr_htn", "고혈압(신손상 위험)", phr?.hypertension ? 0.08 : 0],
      ["phr_dm", "당뇨(당뇨병성 신증 위험)", phr?.diabetes ? 0.08 : 0],
    ];
    const proteinRaw = Math.round(Number(raw.protein ?? 0));
    const scoreTmp = clamp01([...parts, ...boosts].reduce((s, x) => s + Math.max(0, x[2]), 0));
    const zone = (["green", "yellow", "orange", "red"] as const)[Math.min(Math.floor(scoreTmp * 4), 3)];
    out.push(pack("kidney", parts, boosts, { standard: `${KDIGO_A[proteinRaw] ?? "A1"}/${zone}` }));
  }

  // M-DM (당뇨)
  {
    const parts: [string, string, number][] = [
      ["glucose_urine", "요당", c("glucose") * 0.35],
      ["ketone_urine", "케톤", c("ketone") * 0.1],
    ];
    const boosts: [string, string, number][] = [
      ["dka_rule", "요당+케톤(DKA 시사)", f.dka_flag ? 0.15 : 0],
      ["phr_fasting_glucose", "검진 공복혈당", glucoseSev(phr?.glucose ?? null) * 0.3],
      ["phr_glucose_trend", "검진 공복혈당 상승 추세", (phr?.glucose_slope ?? 0) > 2 ? clamp01((phr?.glucose_slope ?? 0) / 15) * 0.1 : 0],
      ["phr_dm_flag", "당뇨 진단/복약", phr?.diabetes ? 0.25 : 0],
      ["phr_overweight", "과체중(BMI≥25)", phr?.overweight ? 0.05 : 0],
    ];
    out.push(pack("diabetes", parts, boosts));
  }

  // M-HTN (고혈압) — 소변 단독 약함, PHR 주도
  {
    const parts: [string, string, number][] = [
      ["protein_marker", "요단백(신손상 지표)", c("protein") * 0.2],
    ];
    const boosts: [string, string, number][] = [
      ["phr_htn_flag", "고혈압 진단/복약", phr?.hypertension ? 0.55 : 0],
      ["phr_overweight", "과체중", phr?.overweight ? 0.1 : 0],
    ];
    out.push(pack("hypertension", parts, boosts));
  }

  // M-UTI (요로감염) — 요화학 주도
  {
    const parts: [string, string, number][] = [
      ["leukocyte", "백혈구", c("leukocyte") * 0.4],
      ["nitrite", "아질산염", c("nitrite") * 0.3],
      ["blood", "잠혈", c("blood") * 0.12],
    ];
    const boosts: [string, string, number][] = [
      ["uti_rule", "백혈구+아질산염(세균성 UTI 시사)", f.uti_flag ? 0.15 : 0],
    ];
    out.push(pack("uti", parts, boosts));
  }

  // M-LIV (간담도)
  {
    const uro = Number(corrected.urobilinogen ?? 0.2);
    const uroSev = uro > 1.0 ? clamp01((uro - 1.0) / 3) : 0;
    const parts: [string, string, number][] = [
      ["bilirubin", "빌리루빈", c("bilirubin") * 0.4],
      ["urobilinogen", "유로빌리노겐", uroSev * 0.3],
    ];
    out.push(pack("liver", parts, []));
  }

  return out;
}
