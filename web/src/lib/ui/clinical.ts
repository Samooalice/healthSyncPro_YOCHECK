// 의료진 포털용 임상 해석 레퍼런스 — 요화학 항목별 임상적 의의 + 질환별 가이드라인 단서.
// 일반인 화면(analyte.ts/driver.ts)이 "쉬운 설명"이라면, 이쪽은 "임상 근거" 톤.
// 진단·처방이 아닌 선별 정보 보조이며, 최종 판단은 의료진 임상평가에 따른다.
//
// 문구는 messages/*.json 의 clinical 네임스페이스로 이관했다.
// 여기 남은 것은 항목→질환 연결 관계(언어 무관)뿐이다.
import type { Translate } from "@/i18n/t";

/** 항목별 연관 질환 키 */
export const ANALYTE_RELATES: Record<string, string[]> = {
  protein: ["kidney", "hypertension"],
  glucose: ["diabetes"],
  blood: ["kidney", "uti"],
  leukocyte: ["uti"],
  nitrite: ["uti"],
  ketone: ["diabetes"],
  bilirubin: ["liver"],
  urobilinogen: ["liver"],
  specific_gravity: ["kidney"],
  ph: ["uti", "kidney"],
  vitamin_c: [],
};

/** 비정상 시 임상적 의의(감별 단서). 없으면 빈 문자열. */
export function analyteSignificance(t: Translate, a: string): string {
  if (!(a in ANALYTE_RELATES)) return "";
  const s = t(`clinical.significance.${a}`);
  return s === `clinical.significance.${a}` ? "" : s;
}

export const DISEASE_KEYS = ["kidney", "diabetes", "hypertension", "uti", "liver"] as const;
export type DiseaseKey = (typeof DISEASE_KEYS)[number];

export interface DiseaseGuideline {
  /** 표준 가이드라인·등급체계 */
  reference: string;
  /** 등급/병기 해석 단서 */
  staging: string;
  /** 권고 추적검사 */
  followup: string;
}

export function diseaseGuideline(t: Translate, disease: string | null | undefined): DiseaseGuideline | null {
  if (!disease || !(DISEASE_KEYS as readonly string[]).includes(disease)) return null;
  return {
    reference: t(`clinical.guideline.${disease}.reference`),
    staging: t(`clinical.guideline.${disease}.staging`),
    followup: t(`clinical.guideline.${disease}.followup`),
  };
}

/** 위험등급 분포 집계 */
export function gradeDistribution(grades: (string | null | undefined)[]): Record<string, number> {
  const dist: Record<string, number> = { very_high: 0, high: 0, moderate: 0, low: 0 };
  for (const g of grades) if (g && g in dist) dist[g]++;
  return dist;
}
