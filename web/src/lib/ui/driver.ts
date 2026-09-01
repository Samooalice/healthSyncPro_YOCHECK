// 위험 기여 요인(SHAP 피처) → 일반인이 이해하는 설명(실제 값·정상범위·문장).
// 문구는 messages/*.json 의 driver 네임스페이스에 있다. 문장을 조각내지 않고
// 한 문장을 하나의 메시지로 두고 값만 치환한다(어순이 다른 언어에서 문장이 깨지지 않도록).
import { ANALYTE_META, analyteName, formatAnalyte, normalText, analyteStatus } from "./analyte";
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

/** 예/아니오형 검진 기록 피처 */
const YES_NO = new Set([
  "phr_diabetes", "phr_hypertension", "phr_dyslipidemia", "phr_kidney_watch",
]);

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

  if (URINE.has(featureKey)) {
    const name = ANALYTE_META[featureKey] ? analyteName(t, featureKey) : fallbackLabel;
    const valTxt = formatAnalyte(t, featureKey, v ?? null);
    const norm = normalText(t, featureKey);
    const high = v != null && analyteStatus(featureKey, v) !== "normal";
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

  if (YES_NO.has(featureKey)) {
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

  switch (featureKey) {
    case "phr_glucose": {
      const high = (v ?? 0) >= 100;
      return {
        label: t("driver.label.phr_glucose"),
        valueText: v != null ? `${v} mg/dL` : "-",
        normalText: t("driver.normal.phr_glucose"),
        source: "phr",
        isHigh: high,
        sentence: v == null
          ? t("driver.missing.phr_glucose")
          : t(high ? "driver.sentence.phr_glucose_high" : "driver.sentence.phr_glucose", { value: v }),
      };
    }
    case "phr_egfr": {
      const low = (v ?? 99) < 90;
      return {
        label: t("driver.label.phr_egfr"),
        valueText: v != null ? `${v}` : "-",
        normalText: t("driver.normal.phr_egfr"),
        source: "phr",
        isHigh: low,
        sentence: v == null
          ? t("driver.missing.phr_egfr")
          : t(low ? "driver.sentence.phr_egfr_low" : "driver.sentence.phr_egfr", { value: v }),
      };
    }
    case "phr_bmi": {
      const high = (v ?? 22) >= 25;
      return {
        label: t("driver.label.phr_bmi"),
        valueText: v != null ? `${v}` : "-",
        normalText: t("driver.normal.phr_bmi"),
        source: "phr",
        isHigh: high,
        sentence: v == null
          ? t("driver.missing.phr_bmi")
          : t(high ? "driver.sentence.phr_bmi_high" : "driver.sentence.phr_bmi", { value: v }),
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
        valueText: t("driver.count.items", { n: v ?? 0 }),
        normalText: t("driver.count.items", { n: 0 }),
        source: "pattern",
        isHigh: (v ?? 0) > 0,
        sentence: t("driver.sentence.pos_burden", { n: v ?? 0 }),
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
        valueText: t("driver.count.times", { n: v ?? 0 }),
        normalText: t("driver.count.times", { n: 0 }),
        source: "pattern",
        isHigh: (v ?? 0) >= 2,
        sentence: (v ?? 0) >= 2 ? t("driver.sentence.protein_consec_pos", { n: v ?? 0 }) : "",
      };
    default:
      return {
        label: fallbackLabel,
        valueText: v != null ? `${v}` : "-",
        normalText: "-",
        source: "pattern",
        isHigh: false,
        sentence: "",
      };
  }
}
