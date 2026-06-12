// 규제 메타데이터 단일 소스 (규제·임상·법무 초안집 문서1·5 / 상세실행판 12장).
// SaMD(의료기기 후보) vs 웰니스 트랙 분리·의도된 사용·라벨링·준비 문서·파일럿 단계.
// ※ 본 내용은 가정·초안이며, 실제 SaMD 해당성·등급은 식약처 사전상담으로 확정한다.

/** 의도된 사용 명세(Intended Use) — 인허가 핵심 문서의 요약본. */
export const INTENDED_USE = {
  purpose: "요화학(소변) 검사와 개인 건강기록(PHR)을 결합해 만성질환 위험을 선별·계층화하고, 사용자의 이해·생활관리·의료진 상담 연계를 돕는다.",
  users: "일반 이용자(건강관리)·의료진(모니터링 보조)·시설/검진센터.",
  environment: "가정·검진센터·의료기관 등에서 인터넷 연결 환경.",
  notIntended: "확정 진단·처방·응급의료 판단을 대체하지 않으며, 최종 임상 판단은 의료진에게 있다.",
};

export type Track = "samd" | "wellness" | "review";

export interface FeatureClass {
  feature: string;
  track: Track;
  likelihood: string; // SaMD 가능성
  basis: string;
}

/** SaMD 후보 기능 식별 표 (문서1 1.2) */
export const FEATURE_CLASSIFICATION: FeatureClass[] = [
  { feature: "위험계층화(질환별 위험점수·등급)", track: "samd", likelihood: "높음", basis: "질환 위험 정보를 산출·제공" },
  { feature: "표준 위험등급 산출(KDIGO형)", track: "samd", likelihood: "높음", basis: "임상 분류 체계 매핑" },
  { feature: "설명 리포트(위험 근거·SHAP)", track: "samd", likelihood: "중간", basis: "위험계층화에 종속" },
  { feature: "측정 수집·품질보정", track: "review", likelihood: "낮음~중간", basis: "데이터 처리 성격" },
  { feature: "생활관리·교육 콘텐츠", track: "wellness", likelihood: "낮음", basis: "일반 건강정보" },
  { feature: "게이미피케이션·미션", track: "wellness", likelihood: "낮음", basis: "동기부여" },
];

export const TRACK_LABEL: Record<Track, { label: string; color: string; bg: string }> = {
  samd: { label: "의료기기 후보", color: "#a6541b", bg: "#FCEBDD" },
  wellness: { label: "웰니스", color: "#127a6e", bg: "#E1F3EF" },
  review: { label: "검토 필요", color: "#6b21a8", bg: "#F3E8FF" },
};

/** 핵심 준비 문서 체크리스트 (문서1 1.5) — status: ready(구현/일부) | todo(작성 필요) */
export interface PrepDoc { doc: string; status: "ready" | "partial" | "todo"; note: string }
export const PREP_DOCS: PrepDoc[] = [
  { doc: "의도된 사용 명세(Intended Use)", status: "partial", note: "본 모듈에 요약본 정의 — 정식 문서화 필요" },
  { doc: "소프트웨어 요구사항 명세", status: "partial", note: "상세실행판 연계" },
  { doc: "위험관리 파일(위해 분석·완화)", status: "todo", note: "ISO 14971 형식 작성 필요" },
  { doc: "소프트웨어 생명주기 문서", status: "todo", note: "IEC 62304 개발·검증 프로세스" },
  { doc: "검증·확인(V&V) 기록", status: "partial", note: "E2E 스모크·테스트 전략 연계" },
  { doc: "임상 평가 자료", status: "todo", note: "문헌·자체 데이터(파일럿)" },
  { doc: "사이버보안 문서", status: "partial", note: "보안 헤더·레이트리밋·감사로그 적용(Step 8)" },
  { doc: "사용적합성(Usability) 자료", status: "todo", note: "사용성 테스트 필요" },
  { doc: "라벨링·표시 자료", status: "partial", note: "비진단·선별 고지문 전 화면 적용" },
];

/** 임상 검증·파일럿 단계 (문서4 4.2 / 상세실행판 Phase 4) */
export interface PilotPhase { phase: string; goal: string; status: "done" | "active" | "todo" }
export const PILOT_PHASES: PilotPhase[] = [
  { phase: "내부 검증", goal: "알고리즘 재현성·E2E 사용자 여정·보안 점검", status: "active" },
  { phase: "시설/검진센터 파일럿", goal: "실사용 데이터로 위험계층화 유용성·사용성 평가", status: "todo" },
  { phase: "임상적 평가", goal: "표준검사 대비 성능·안전성 근거 수집", status: "todo" },
  { phase: "SaMD 인허가 신청", goal: "기술문서·임상평가 패키지 제출(식약처)", status: "todo" },
];

export const PREP_STATUS_LABEL: Record<PrepDoc["status"], { label: string; color: string }> = {
  ready: { label: "완료", color: "#127a6e" },
  partial: { label: "일부", color: "#a6541b" },
  todo: { label: "필요", color: "#9ca3af" },
};
export const PILOT_STATUS_LABEL: Record<PilotPhase["status"], { label: string; color: string }> = {
  done: { label: "완료", color: "#127a6e" },
  active: { label: "진행", color: "#2E5A88" },
  todo: { label: "예정", color: "#9ca3af" },
};
