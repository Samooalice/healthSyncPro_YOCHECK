// =====================================================================
// 알고리즘 파라미터 (구현 출발 기본값)
// 출처: db/seed/algo_params.yaml — 앱 런타임용 타입화 사본.
// 주의: 모든 값은 검증·임상자문으로 확정. SaMD 후보(위험계층화·등급).
// 향후: DB 설정 테이블/ML 레지스트리로 외부화하여 코드 수정 없이 튜닝.
// =====================================================================

export type Analyte =
  | "glucose"
  | "protein"
  | "ph"
  | "specific_gravity"
  | "ketone"
  | "blood"
  | "leukocyte"
  | "nitrite"
  | "urobilinogen"
  | "bilirubin"
  | "vitamin_c";

export type Grade = "low" | "moderate" | "high" | "very_high";

export const ALGO_PARAMS = {
  correction: {
    sg_ref: 1.015,
    sg_min: 1.001,
    sg_max: 1.03,
    vitc_decay: 0.15,
    conf_floor: 0.3,
    vitc_targets: ["glucose", "blood", "bilirubin", "nitrite"] as Analyte[],
  },
  baseline: {
    ewma_alpha: 0.2,
    n_min: 3,
    reset_months: 6,
  },
  change_detection: {
    k: 2.0,
    persistence_n: 2,
    min_delta: {
      glucose: 1,
      protein: 1,
      ph: 0.5,
      specific_gravity: 0.005,
      ketone: 1,
      blood: 1,
      leukocyte: 1,
      nitrite: 1,
      urobilinogen: 0.5,
      bilirubin: 1,
    } as Record<string, number>,
  },
  grade_thresholds: {
    low: [0.0, 0.249],
    moderate: [0.25, 0.499],
    high: [0.5, 0.749],
    very_high: [0.75, 1.0],
  } as Record<Grade, [number, number]>,
  disease_weights: {
    kidney: {
      protein_dev: 0.45,
      blood_dev: 0.2,
      leukocyte_dev: 0.1,
      sg_trend: 0.1,
      protein_persistence: 0.15,
    },
  } as Record<string, Record<string, number>>,
  performance_targets: {
    auroc_min: 0.8,
    recall_min: 0.75,
    specificity_min: 0.7,
    ece_max: 0.05,
  },
  explanation: {
    top_k: 5,
    user_visible_k: 3,
    counterfactual_target: "low" as Grade,
    counterfactual_max: 2,
  },
  // 정상 참고값(반정량은 0=음성) / 콜드스타트 SD (표본 부족 시 인구 기준)
  analyte_master: {
    glucose: { normal: 0, cold_sd: 0.5 },
    protein: { normal: 0, cold_sd: 0.4 },
    ph: { normal: 6.0, cold_sd: 0.7 },
    specific_gravity: { normal: 1.015, cold_sd: 0.006 },
    ketone: { normal: 0, cold_sd: 0.4 },
    blood: { normal: 0, cold_sd: 0.4 },
    leukocyte: { normal: 0, cold_sd: 0.4 },
    nitrite: { normal: 0, cold_sd: 0.3 },
    urobilinogen: { normal: 0.2, cold_sd: 0.5 },
    bilirubin: { normal: 0, cold_sd: 0.3 },
    vitamin_c: { normal: 0, cold_sd: 0.4 },
  } as Record<Analyte, { normal: number; cold_sd: number }>,
} as const;

// 모델 버전 식별 (추적성). Step 1 = 규칙기반 베이스라인 분석기.
export const MODEL_VERSION = "kidney-rulebased-2026.06.01";
