// 동의 항목 정의 (개인정보보호법: 건강=민감정보). 운영 시 법무·개인정보 검토로 확정.
// 참고: 세부개발데이터 consent_type enum (sensitive_health/marketing/research/third_party)
//
// 표시 문구는 messages/*.json 의 consent 네임스페이스에 있다.
// ⚠️ 동의문은 법적 효력이 있는 문서다. 한국어를 정본으로 하고 다른 언어는 참고 번역이며,
//    해외 서비스 시에는 각 관할 법령에 맞춰 법무 검토를 거쳐야 한다 (05_용어집 5장 참조).
export const CONSENT_VERSION = "v1.0";

export interface ConsentDef {
  type: string;
  required: boolean;
}

// 의료진 가입용 동의·서약 (환자 PHI 취급). 운영 시 법무·개인정보 검토로 확정.
export const CLINICIAN_CONSENT_DEFS: ConsentDef[] = [
  { type: "clinician_terms", required: true },
  { type: "phi_handling", required: true },
];

export const CONSENT_DEFS: ConsentDef[] = [
  { type: "sensitive_health", required: true },
  { type: "research", required: false },
  { type: "marketing", required: false },
];

/** 동의 항목 문구 메시지 경로 — consent.<type>.label | .desc */
export function consentLabelKey(type: string): string {
  return `consent.${type}.label`;
}
export function consentDescKey(type: string): string {
  return `consent.${type}.desc`;
}
