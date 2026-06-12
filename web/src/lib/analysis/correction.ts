// P2 — 측정 품질 보정 (학습/서빙 공유 로직)
// 비중(specific gravity) 농도 정규화 + 비타민C 교란 신뢰가중치.
// 참고: 세부개발데이터 6.1 / algo_params.correction
import { ALGO_PARAMS, type Analyte } from "@/config/algoParams";

export type RawValues = Partial<Record<Analyte, number>>;

export interface CorrectionResult {
  corrected: RawValues;
  confidence: Partial<Record<Analyte, number>>;
  sg_normalized: boolean;
  vitc_flag: boolean;
}

const P = ALGO_PARAMS.correction;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * 측정값 보정. 비중으로 희석/농축을 정규화하고, 비타민C가 검출되면
 * 영향을 받는 항목(요당·잠혈·빌리루빈·아질산염)의 신뢰가중치를 낮춘다.
 */
export function correctMeasurement(raw: RawValues): CorrectionResult {
  const sgRaw = raw.specific_gravity ?? P.sg_ref;
  const sg = clamp(sgRaw, P.sg_min, P.sg_max);
  const vitc = raw.vitamin_c ?? 0;

  const corrected: RawValues = {};
  const confidence: Partial<Record<Analyte, number>> = {};

  for (const [k, vRaw] of Object.entries(raw) as [Analyte, number | undefined][]) {
    if (vRaw == null) continue; // 결측 허용
    const value = vRaw;

    if (k === "specific_gravity" || k === "vitamin_c") {
      corrected[k] = value;
      confidence[k] = 1.0;
      continue;
    }

    // 비중 정규화 (희석/농축 보정)
    const denom = Math.max(sg - 1.0, 1e-4);
    const norm = value * ((P.sg_ref - 1.0) / denom);
    corrected[k] = norm;

    // 비타민C 교란 → 신뢰가중치 하향
    if (P.vitc_targets.includes(k) && vitc > 0) {
      confidence[k] = Math.max(P.conf_floor, 1.0 - P.vitc_decay * vitc);
    } else {
      confidence[k] = 1.0;
    }
  }

  return {
    corrected,
    confidence,
    sg_normalized: true,
    vitc_flag: vitc > 0,
  };
}
