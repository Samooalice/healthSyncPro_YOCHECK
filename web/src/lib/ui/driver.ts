// 위험 기여 요인(SHAP 피처) → 일반인이 이해하는 설명(실제 값·정상범위·문장).
// 문구는 messages/*.json 의 driver / feature 네임스페이스에 있다. 문장을 조각내지 않고
// 한 문장을 하나의 메시지로 두고 값만 치환한다(어순이 다른 언어에서 문장이 깨지지 않도록).
//
// ⚠️ 피처 키가 두 체계다.
//   · ML 서비스(LightGBM)는 ml/features.py 의 키를 준다 — glucose, phr_glucose, dka_flag …
//   · 룰 엔진(analysis/engine.ts)은 자체 키를 쓴다 — glucose_urine, phr_fasting_glucose, dka_rule …
//   이 함수는 원래 ML 키만 알고 있어서, 룰 엔진 결과는 전부 default 로 떨어져
//   "라벨 그대로 + 값 '-' + 설명 없음 + 출처 '패턴'" 으로 나왔다(다국어 전에는 라벨이
//   한국어라 티가 안 났다). 아래 ANALYTE_ALIAS/sourceOfKey 로 최소한 **라벨과 출처는**
//   정확히 보여준다.
//
//   값(value)이 없으면 상세 문장을 지어내지 않는다. 룰 엔진 결과에는 value 가 없는데,
//   "없음"·"정상 범위" 같은 문장을 만들어 붙이면 **사실과 다른 안내**가 된다.
import { ANALYTE_META, analyteName, formatAnalyte, normalText, analyteStatus } from "./analyte";
import { featureLabel } from "./labels";
import type { Translate } from "@/i18n/t";

/** 근거 출처 — 표시 문구는 driver.source.* 카탈로그. */
export type DriverSource = "urine" | "phr" | "pattern";

export interface DriverInfo {
  label: string; // 무엇인지 (평이한 이름)
  valueText: string; // 측정/검진 값
  normalText: string; // 정상 기준
  sentence: string; // 한 문장 설명
  isHigh: boolean; // 위험을 높인 요인인지
  source: DriverSource;
}

const URINE = new Set(["glucose", "protein", "blood", "leukocyte", "ketone", "nitrite", "bilirubin", "urobilinogen", "ph", "specific_gravity", "vitamin_c"]);

/** 룰 엔진의 요화학 파생 키 → 기본 항목 */
const ANALYTE_ALIAS: Record<string, string> = {
  protein_dev: "protein",
  protein_marker: "protein",
  protein_personal_dev: "protein",
  protein_persistence: "protein",
  protein_trend_slope: "protein",
  blood_dev: "blood",
  leukocyte_dev: "leukocyte",
  glucose_urine: "glucose",
  ketone_urine: "ketone",
};

/** 예/아니오형 검진 기록 피처 */
const YES_NO = new Set([
  "phr_diabetes", "phr_hypertension", "phr_dyslipidemia", "phr_kidney_watch",
]);

/** 상세 설명을 못 만들 때도 출처 배지는 정확하게. */
function sourceOfKey(key: string): DriverSource {
  if (URINE.has(key) || key in ANALYTE_ALIAS) return "urine";
  if (key.startsWith("phr_")) return "phr";
  return "pattern";
}

export function sourceLabel(t: Translate, s: DriverSource): string {
  return t(`driver.source.${s}`);
}

export function describeDriver(
  t: Translate,
  featureKey: string,
  value: number | undefined,
  fallbackLabel: string,
): DriverInfo {
  const v = value;

  // 요화학 항목 — 값이 있어야 값·정상범위·문장을 만들 수 있다.
  const analyte = URINE.has(featureKey) ? featureKey : ANALYTE_ALIAS[featureKey];
  if (analyte && v != null) {
    const name = ANALYTE_META[analyte] ? analyteName(t, analyte) : fallbackLabel;
    const valTxt = formatAnalyte(t, analyte, v);
    const norm = normalText(t, analyte);
    const high = analyteStatus(analyte, v) !== "normal";
    return {
      label: t("driver.urine.label", { name }),
      valueText: valTxt,
      normalText: norm,
      source: "urine",
      isHigh: high,
      sentence: t(high ? "driver.urine.high" : "driver.urine.normal", {
        name, value: valTxt, normal: norm,
      }),
    };
  }

  if (YES_NO.has(featureKey) && v != null) {
    const label = t(`driver.label.${featureKey}`);
    const on = !!v;
    return {
      label,
      valueText: t(on ? "driver.yesNo.present" : "driver.yesNo.absent"),
      normalText: t("driver.yesNo.absent"),
      source: "phr",
      isHigh: on,
      sentence: t(on ? "driver.yesNo.confirmed" : "driver.yesNo.none", { label }),
    };
  }

  if (v != null) {
    switch (featureKey) {
      case "phr_glucose": {
        const high = v >= 100;
        return {
          label: t("driver.label.phr_glucose"),
          valueText: `${v} mg/dL`,
          normalText: t("driver.normal.phr_glucose"),
          source: "phr",
          isHigh: high,
          sentence: t(high ? "driver.sentence.phr_glucose_high" : "driver.sentence.phr_glucose", { value: v }),
        };
      }
      case "phr_egfr": {
        const low = v < 90;
        return {
          label: t("driver.label.phr_egfr"),
          valueText: `${v}`,
          normalText: t("driver.normal.phr_egfr"),
          source: "phr",
          isHigh: low,
          sentence: t(low ? "driver.sentence.phr_egfr_low" : "driver.sentence.phr_egfr", { value: v }),
        };
      }
      case "phr_bmi": {
        const high = v >= 25;
        return {
          label: t("driver.label.phr_bmi"),
          valueText: `${v}`,
          normalText: t("driver.normal.phr_bmi"),
          source: "phr",
          isHigh: high,
          sentence: t(high ? "driver.sentence.phr_bmi_high" : "driver.sentence.phr_bmi", { value: v }),
        };
      }
      case "phr_overweight":
        return {
          label: t("driver.label.phr_overweight"),
          valueText: t(v ? "driver.applies.yes" : "driver.applies.no"),
          normalText: t("driver.applies.no"),
          source: "phr",
          isHigh: !!v,
          sentence: t(v ? "driver.sentence.phr_overweight_high" : "driver.sentence.phr_overweight"),
        };
      case "pos_burden":
        return {
          label: t("driver.label.pos_burden"),
          valueText: t("driver.count.items", { n: v }),
          normalText: t("driver.count.items", { n: 0 }),
          source: "pattern",
          isHigh: v > 0,
          sentence: t("driver.sentence.pos_burden", { n: v }),
        };
      case "uti_flag":
      case "dka_flag":
      case "nephritis_flag":
        return {
          label: t(`driver.label.${featureKey}`),
          valueText: t(v ? "driver.bool.yes" : "driver.bool.no"),
          normalText: t("driver.bool.no"),
          source: "pattern",
          isHigh: !!v,
          sentence: v ? t(`driver.sentence.${featureKey}`) : "",
        };
      case "protein_consec_pos":
        return {
          label: t("driver.label.protein_consec_pos"),
          valueText: t("driver.count.times", { n: v }),
          normalText: t("driver.count.times", { n: 0 }),
          source: "pattern",
          isHigh: v >= 2,
          sentence: v >= 2 ? t("driver.sentence.protein_consec_pos", { n: v }) : "",
        };
    }
  }

  // 값이 없거나 아직 상세 설명이 없는 피처 — 라벨과 출처만 정확히 보여주고,
  // 값·문장은 지어내지 않는다.
  return {
    label: featureLabel(t, featureKey, fallbackLabel),
    valueText: "-",
    normalText: "-",
    sentence: "",
    isHigh: false,
    source: sourceOfKey(featureKey),
  };
}
