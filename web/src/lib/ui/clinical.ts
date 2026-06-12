// 의료진 포털용 임상 해석 레퍼런스 — 요화학 항목별 임상적 의의 + 질환별 가이드라인 단서.
// 일반인 화면(analyte.ts/driver.ts)이 "쉬운 설명"이라면, 이쪽은 "임상 근거" 톤.
// 진단·처방이 아닌 선별 정보 보조이며, 최종 판단은 의료진 임상평가에 따른다.

export interface AnalyteClinical {
  /** 비정상 시 임상적 의의(감별 단서) */
  significance: string;
  /** 연관 질환 키 */
  relates: string[];
}

export const ANALYTE_CLINICAL: Record<string, AnalyteClinical> = {
  protein: { significance: "사구체·세뇨관 손상 지표. 지속성 단백뇨는 CKD 진행·심혈관 위험과 연관(알부민뇨 정량 권고).", relates: ["kidney", "hypertension"] },
  glucose: { significance: "혈당이 신장 역치(~180mg/dL)를 넘으면 출현. 당뇨 의심·혈당조절 불량 시사(공복혈당·HbA1c 확인).", relates: ["diabetes"] },
  blood: { significance: "혈뇨 — 요로결석·감염·사구체신염·종양 등 감별 필요. 지속 시 영상·요세포검사 고려.", relates: ["kidney", "uti"] },
  leukocyte: { significance: "농뇨 — 요로감염 시사. 아질산염·증상과 종합 판단.", relates: ["uti"] },
  nitrite: { significance: "그람음성균(장내세균) 감염 시사. 백혈구 동반 시 요로감염 가능성↑.", relates: ["uti"] },
  ketone: { significance: "케톤뇨 — 당뇨케톤산증·기아·저탄수화물 식이. 고혈당 동반 시 주의.", relates: ["diabetes"] },
  bilirubin: { significance: "간담도 질환(폐쇄성 황달·간세포 손상) 단서. 간기능검사 연계.", relates: ["liver"] },
  urobilinogen: { significance: "상승 시 용혈·간세포 질환 가능. 빌리루빈과 함께 해석.", relates: ["liver"] },
  specific_gravity: { significance: "신장 농축능·수화상태 반영. 탈수·요붕증 등 단서.", relates: ["kidney"] },
  ph: { significance: "산-염기 상태·결석 유형·요로감염 단서. 지속적 알칼리뇨는 요소분해균 감염 시사.", relates: ["uti", "kidney"] },
  vitamin_c: { significance: "시험지 교란요인 — 고농도 시 잠혈·요당 위음성 가능. 결과 해석 시 주의.", relates: [] },
};

export interface DiseaseGuideline {
  /** 표준 가이드라인·등급체계 */
  reference: string;
  /** 등급/병기 해석 단서 */
  staging: string;
  /** 권고 추적검사 */
  followup: string;
}

export const DISEASE_GUIDELINE: Record<string, DiseaseGuideline> = {
  kidney: {
    reference: "KDIGO 2024 CKD 가이드라인 — eGFR·알부민뇨(ACR) 기반 위험계층(녹/황/주황/적)",
    staging: "요단백 반정량은 선별 단계. 확진·병기설정은 혈청 크레아티닌(eGFR)·ACR 정량 필요.",
    followup: "권고: 혈청 크레아티닌·eGFR, 소변 알부민/크레아티닌비(uACR), 필요 시 신장내과 의뢰.",
  },
  diabetes: {
    reference: "대한당뇨병학회·ADA — 공복혈당/HbA1c 진단기준 (요당은 보조지표)",
    staging: "요당 양성은 고혈당 가능성 시사이나 진단기준 아님. 공복혈당·HbA1c로 확인.",
    followup: "권고: 공복혈당·HbA1c, 당뇨 합병증(신장·안저) 선별.",
  },
  hypertension: {
    reference: "대한고혈압학회 — 진료실/가정혈압 분류, 표적장기손상 평가",
    staging: "단백뇨는 고혈압성 표적장기(신장) 손상 지표로 활용. 혈압 측정값과 종합.",
    followup: "권고: 반복 혈압측정, 소변 알부민, 심전도·지질 등 위험인자 평가.",
  },
  uti: {
    reference: "요로감염 진료지침 — 농뇨·아질산염·증상 종합, 무증상 세균뇨 감별",
    staging: "백혈구·아질산염 양성 + 배뇨증상 시 UTI 가능성. 무증상은 치료 대상 아닐 수 있음.",
    followup: "권고: 증상 동반 시 요배양·항생제 감수성, 재발성은 원인 평가.",
  },
  liver: {
    reference: "간담도 평가 — 빌리루빈·유로빌리노겐 패턴 + 간기능검사",
    staging: "요 빌리루빈/유로빌리노겐은 보조 단서. 패턴(폐쇄성 vs 간세포성) 감별 필요.",
    followup: "권고: 간기능검사(AST/ALT/ALP/총빌리루빈), 필요 시 영상검사.",
  },
};

/** 위험등급 분포 집계 */
export function gradeDistribution(grades: (string | null | undefined)[]): Record<string, number> {
  const dist: Record<string, number> = { very_high: 0, high: 0, moderate: 0, low: 0 };
  for (const g of grades) if (g && g in dist) dist[g]++;
  return dist;
}
