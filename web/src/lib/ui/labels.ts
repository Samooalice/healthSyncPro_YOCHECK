// 화면 공용 라벨·토큰 (세부개발데이터 A.4 색상토큰 / A.1 항목)
export const GRADE_TOKEN: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "양호", color: "#2E9E5B", bg: "#E8F6EE" },
  moderate: { label: "관찰 필요", color: "#E8B500", bg: "#FBF4D9" },
  high: { label: "주의", color: "#E8730C", bg: "#FCEBDD" },
  very_high: { label: "높음", color: "#D32F2F", bg: "#FBE3E3" },
};

export const ANALYTE_KO: Record<string, string> = {
  glucose: "요당",
  protein: "요단백",
  ph: "산도",
  specific_gravity: "비중",
  ketone: "케톤",
  blood: "잠혈",
  leukocyte: "백혈구",
  nitrite: "아질산염",
  urobilinogen: "유로빌리노겐",
  bilirubin: "빌리루빈",
  vitamin_c: "비타민C",
};

export const CARE_KO: Record<string, string> = {
  lifestyle: "생활관리 미션",
  recheck: "재측정 권장",
  referral: "진료의뢰 리포트",
  emergency: "의료진 상담 권장",
};

export const DISEASE_KO: Record<string, string> = {
  kidney: "신장",
  diabetes: "당뇨",
  hypertension: "고혈압",
  uti: "요로감염",
  liver: "간담도",
};
