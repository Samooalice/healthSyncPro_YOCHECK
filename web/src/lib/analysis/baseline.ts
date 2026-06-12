// P1 — 개인화 기준선(EWMA 증분 갱신) + 변화판정(개인 임계 + 지속성)
// 참고: 세부개발데이터 6.2 / algo_params.baseline·change_detection
import { ALGO_PARAMS, type Analyte } from "@/config/algoParams";

export interface Baseline {
  mean: number;
  sd: number;
  cv: number;
  n_samples: number;
}

const B = ALGO_PARAMS.baseline;
const CD = ALGO_PARAMS.change_detection;

/** 지수가중이동평균(EWMA) 기반 기준선 증분 갱신. */
export function updateBaseline(prev: Baseline | null, x: number, alpha = B.ewma_alpha): Baseline {
  if (!prev || prev.n_samples === 0) {
    return { mean: x, sd: 0, cv: 0, n_samples: 1 };
  }
  const newMean = (1 - alpha) * prev.mean + alpha * x;
  const variance = (1 - alpha) * prev.sd ** 2 + alpha * (x - newMean) ** 2;
  const newSd = Math.sqrt(variance);
  const cv = newMean ? newSd / newMean : 0;
  return { mean: newMean, sd: newSd, cv, n_samples: prev.n_samples + 1 };
}

/**
 * 콜드스타트 보정: 표본이 n_min 미만이면 인구 기준(normal/cold_sd)을 사용해
 * 편차를 추정한다. 표본이 충분하면 개인 기준선을 사용.
 */
export function effectiveStats(analyte: Analyte, baseline: Baseline | null): { mean: number; sd: number } {
  const master = ALGO_PARAMS.analyte_master[analyte];
  if (!baseline || baseline.n_samples < B.n_min || baseline.sd <= 0) {
    return { mean: master.normal, sd: master.cold_sd };
  }
  return { mean: baseline.mean, sd: baseline.sd };
}

/** 기준선 대비 편차를 SD 단위로 반환(부호 유지). */
export function deviationSd(analyte: Analyte, value: number, baseline: Baseline | null): number {
  const { mean, sd } = effectiveStats(analyte, baseline);
  if (sd <= 0) return 0;
  return (value - mean) / sd;
}

/**
 * 개인 임계 T = max(k·sd, min_delta) 초과 + 지속성(연속 이탈) 확인.
 * history: 직전 측정값들(최신이 뒤). 지속성 충족 시 유의 변화로 확정.
 */
export function detectChange(
  analyte: Analyte,
  value: number,
  baseline: Baseline | null,
  history: number[] = [],
): { isDeviation: boolean; persistent: boolean; threshold: number } {
  const { mean, sd } = effectiveStats(analyte, baseline);
  const minDelta = CD.min_delta[analyte] ?? 0;
  const T = Math.max(CD.k * sd, minDelta);
  const isDeviation = Math.abs(value - mean) > T;
  // 지속성: 직전 측정도 이탈했는가 (persistence_n=2 → 최근 2회 연속)
  const prev = history.length ? history[history.length - 1] : null;
  const prevDeviation = prev != null ? Math.abs(prev - mean) > T : false;
  return { isDeviation, persistent: isDeviation && prevDeviation, threshold: T };
}
