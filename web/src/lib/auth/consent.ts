// 동의 항목 정의 (개인정보보호법: 건강=민감정보). 운영 시 법무·개인정보 검토로 확정.
// 참고: 세부개발데이터 consent_type enum (sensitive_health/marketing/research/third_party)
export const CONSENT_VERSION = "v1.0";

export interface ConsentDef {
  type: string;
  label: string;
  required: boolean;
  desc: string;
}

// 의료진 가입용 동의·서약 (환자 PHI 취급). 운영 시 법무·개인정보 검토로 확정.
export const CLINICIAN_CONSENT_DEFS: ConsentDef[] = [
  {
    type: "clinician_terms",
    label: "[필수] 의료진 이용약관 및 면허 정보 제공 동의",
    required: true,
    desc: "면허 종류·번호·소속 정보를 자격 확인(승인) 목적으로 처리합니다.",
  },
  {
    type: "phi_handling",
    label: "[필수] 환자 건강정보(PHI) 취급·보호 서약",
    required: true,
    desc: "진료·관리 목적 범위 내에서만 환자 정보를 열람하며, 모든 열람은 감사 기록됨에 동의합니다.",
  },
];

export const CONSENT_DEFS: ConsentDef[] = [
  {
    type: "sensitive_health",
    label: "[필수] 민감정보(건강정보) 수집·이용 및 서비스 이용약관",
    required: true,
    desc: "소변검사 측정값·위험분석 등 건강정보를 서비스 제공 목적으로 처리합니다.",
  },
  {
    type: "research",
    label: "[선택] 연구·통계 활용(비식별)",
    required: false,
    desc: "비식별 처리 후 알고리즘 개선·연구에 활용합니다.",
  },
  {
    type: "marketing",
    label: "[선택] 마케팅 정보 수신",
    required: false,
    desc: "건강 팁·서비스 소식을 이메일 등으로 받아봅니다.",
  },
];
