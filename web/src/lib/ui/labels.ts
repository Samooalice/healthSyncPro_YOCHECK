// 화면 공용 토큰 (세부개발데이터 A.4 색상토큰 / A.1 항목)
// 라벨 문구는 messages/*.json 의 grade / analyte / care / disease 네임스페이스로 이관했다.
// 여기에는 언어와 무관한 색상 토큰만 남는다.
import type { Translate } from "@/i18n/t";

export const GRADE_TOKEN: Record<string, { color: string; bg: string }> = {
  low: { color: "#2E9E5B", bg: "#E8F6EE" },
  moderate: { color: "#E8B500", bg: "#FBF4D9" },
  high: { color: "#E8730C", bg: "#FCEBDD" },
  very_high: { color: "#D32F2F", bg: "#FBE3E3" },
};

/** 위험등급 라벨 — 양호/관찰 필요/주의/높음. 진단 표현이 아닌 관리 등급이다. */
export function gradeLabel(t: Translate, grade: string | null | undefined): string {
  return grade && grade in GRADE_TOKEN ? t(`grade.${grade}`) : t("grade.low");
}

/** 케어 액션 유형 라벨. 카탈로그에 없으면 원 코드값을 그대로 보여준다. */
export function careLabel(t: Translate, key: string): string {
  const s = t(`care.${key}`);
  return s === `care.${key}` ? key : s;
}

/** 질환군 라벨. */
export function diseaseLabel(t: Translate, key: string | null | undefined): string {
  if (!key) return "-";
  const s = t(`disease.${key}`);
  return s === `disease.${key}` ? key : s;
}

/** 위험 기여 피처 라벨 — feature.*. 카탈로그에 없으면 ML 이 준 라벨, 그것도 없으면 키. */
export function featureLabel(t: Translate, key: string, fallback?: string): string {
  const s = t(`feature.${key}`);
  return s === `feature.${key}` ? fallback ?? key : s;
}
