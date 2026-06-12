// ML 분석 서비스 클라이언트 — LightGBM+SHAP(Python FastAPI) 호출. 장애 시 null → 룰 폴백.
import type { RawValues } from "./correction";
import type { Features } from "./engine";
import type { PhrFlags } from "@/lib/phr/ingest";

export interface MlDisease {
  disease: string;
  label: string;
  risk_score: number;
  risk_grade: "low" | "moderate" | "high" | "very_high";
  standard_grade: string | null;
  shap_top: { feature_key: string; feature: string; shap: number; value: number }[];
}
export interface MlResponse { model_version: string; results: MlDisease[] }

const n = (v: unknown, d = 0): number => { const x = Number(v); return Number.isFinite(x) ? x : d; };

/** 요화학 + 도메인/시계열 피처 + PHR → ML 입력 피처 dict (ml/features.py FEATURES 와 일치). */
export function buildFeatures(raw: RawValues, f: Features, phr: PhrFlags | null): Record<string, number> {
  return {
    glucose: n(raw.glucose), protein: n(raw.protein), blood: n(raw.blood), leukocyte: n(raw.leukocyte),
    ketone: n(raw.ketone), nitrite: n(raw.nitrite), bilirubin: n(raw.bilirubin), vitamin_c: n(raw.vitamin_c),
    urobilinogen: n(raw.urobilinogen, 0.2), ph: n(raw.ph, 6.0), specific_gravity: n(raw.specific_gravity, 1.015),
    pos_burden: f.pos_burden,
    uti_flag: f.uti_flag ? 1 : 0, dka_flag: f.dka_flag ? 1 : 0, nephritis_flag: f.nephritis_flag ? 1 : 0,
    dehydration_flag: f.dehydration_flag ? 1 : 0, vitc_disturbance: f.vitc_disturbance ? 1 : 0,
    protein_consec_pos: f.protein_consec_pos, protein_trend_slope: f.protein_trend_slope,
    phr_present: phr ? 1 : 0,
    phr_glucose: phr?.glucose ?? 90, phr_egfr: phr?.egfr ?? 100, phr_bmi: phr?.bmi ?? 22,
    phr_diabetes: phr?.diabetes ? 1 : 0, phr_hypertension: phr?.hypertension ? 1 : 0,
    phr_dyslipidemia: phr?.dyslipidemia ? 1 : 0, phr_kidney_watch: phr?.kidney_watch ? 1 : 0,
    phr_overweight: phr?.overweight ? 1 : 0,
  };
}

/** ML 서비스 추론. 미설정/장애/타임아웃 시 null(→ 호출측 룰 폴백). */
export async function mlPredict(features: Record<string, number>): Promise<MlResponse | null> {
  const base = process.env.ML_SERVICE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/predict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ features }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as MlResponse;
  } catch {
    return null;
  }
}
