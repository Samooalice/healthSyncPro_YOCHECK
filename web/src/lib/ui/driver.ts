// 위험 기여 요인(SHAP 피처) → 일반인이 이해하는 설명(실제 값·정상범위·문장).
import { ANALYTE_META, formatAnalyte, normalText, analyteStatus } from "./analyte";

export interface DriverInfo {
  label: string; // 무엇인지 (평이한 이름)
  valueText: string; // 측정/검진 값
  normalText: string; // 정상 기준
  sentence: string; // 한 문장 설명
  isHigh: boolean; // 위험을 높인 요인인지
  source: "소변검사" | "건강검진" | "패턴";
}

const URINE = new Set(["glucose", "protein", "blood", "leukocyte", "ketone", "nitrite", "bilirubin", "urobilinogen", "ph", "specific_gravity", "vitamin_c"]);

export function describeDriver(featureKey: string, value: number | undefined, fallbackLabel: string): DriverInfo {
  const v = value;

  if (URINE.has(featureKey)) {
    const name = ANALYTE_META[featureKey]?.name ?? fallbackLabel;
    const valTxt = formatAnalyte(featureKey, v ?? null);
    const norm = normalText(featureKey);
    const high = (v != null) && analyteStatus(featureKey, v) !== "normal";
    return {
      label: `소변 ${name}`, valueText: valTxt, normalText: norm, source: "소변검사", isHigh: high,
      sentence: high ? `소변검사에서 ${name}이(가) ${valTxt}로 나왔어요 (정상: ${norm}).`
                     : `소변검사 ${name}은(는) ${valTxt}로 정상 범위예요.`,
    };
  }

  const yesNo = (label: string, normal = "없음", high = "있음") => {
    const on = !!v;
    return { label, valueText: on ? high : normal, normalText: normal, source: "건강검진" as const, isHigh: on,
      sentence: on ? `건강검진 기록에 ${label}이(가) 확인됐어요.` : `${label}은(는) 없어요.` };
  };

  switch (featureKey) {
    case "phr_glucose": {
      const high = (v ?? 0) >= 100;
      return { label: "건강검진 공복혈당", valueText: v != null ? `${v} mg/dL` : "-", normalText: "100 미만", source: "건강검진", isHigh: high,
        sentence: v != null ? `건강검진 공복혈당이 ${v} mg/dL예요 (정상: 100 미만).${high ? " 높은 편이에요." : ""}` : "공복혈당 기록이 없어요." };
    }
    case "phr_egfr": {
      const low = (v ?? 99) < 90;
      return { label: "신장 기능(eGFR)", valueText: v != null ? `${v}` : "-", normalText: "90 이상", source: "건강검진", isHigh: low,
        sentence: v != null ? `신장 여과기능(eGFR)이 ${v}예요 (정상: 90 이상).${low ? " 다소 낮아요." : ""}` : "eGFR 기록이 없어요." };
    }
    case "phr_bmi": {
      const high = (v ?? 22) >= 25;
      return { label: "체질량지수(BMI)", valueText: v != null ? `${v}` : "-", normalText: "18.5~24.9", source: "건강검진", isHigh: high,
        sentence: v != null ? `체질량지수(BMI)가 ${v}예요 (정상: 18.5~24.9).${high ? " 과체중 범위예요." : ""}` : "BMI 기록이 없어요." };
    }
    case "phr_diabetes": return yesNo("당뇨 진단·약 복용");
    case "phr_hypertension": return yesNo("고혈압 진단·약 복용");
    case "phr_dyslipidemia": return yesNo("이상지질혈증(고지혈증) 기록");
    case "phr_kidney_watch": return yesNo("신장 관련 주의 소견");
    case "phr_overweight": return { label: "과체중", valueText: v ? "해당" : "비해당", normalText: "비해당", source: "건강검진", isHigh: !!v, sentence: v ? "체중이 다소 높은 편이에요." : "체중은 정상 범위예요." };
    case "pos_burden": return { label: "양성으로 나온 검사 항목 수", valueText: `${v ?? 0}개`, normalText: "0개", source: "패턴", isHigh: (v ?? 0) > 0, sentence: `소변검사에서 ${v ?? 0}개 항목이 양성으로 나왔어요.` };
    case "uti_flag": return { label: "백혈구·아질산염 동시 양성", valueText: v ? "예" : "아니오", normalText: "아니오", source: "패턴", isHigh: !!v, sentence: v ? "요로감염을 시사하는 조합(백혈구+아질산염)이 함께 나왔어요." : "" };
    case "dka_flag": return { label: "요당·케톤 동시 양성", valueText: v ? "예" : "아니오", normalText: "아니오", source: "패턴", isHigh: !!v, sentence: v ? "혈당 조절 이상을 시사하는 조합(요당+케톤)이 나왔어요." : "" };
    case "nephritis_flag": return { label: "단백·잠혈 동시 양성", valueText: v ? "예" : "아니오", normalText: "아니오", source: "패턴", isHigh: !!v, sentence: v ? "신장 염증을 시사하는 조합(단백+잠혈)이 나왔어요." : "" };
    case "protein_consec_pos": return { label: "단백뇨 연속 양성", valueText: `${v ?? 0}회`, normalText: "0회", source: "패턴", isHigh: (v ?? 0) >= 2, sentence: (v ?? 0) >= 2 ? `단백뇨가 ${v}회 연속 나왔어요. 지속되는 신호예요.` : "" };
    default: return { label: fallbackLabel, valueText: v != null ? `${v}` : "-", normalText: "-", source: "패턴", isHigh: false, sentence: "" };
  }
}
