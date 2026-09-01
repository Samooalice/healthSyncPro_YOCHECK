// 규제 메타데이터 단일 소스 (규제·임상·법무 초안집 문서1·5 / 상세실행판 12장).
// SaMD(의료기기 후보) vs 웰니스 트랙 분리·의도된 사용·라벨링·준비 문서·파일럿 단계.
// ※ 본 내용은 가정·초안이며, 실제 SaMD 해당성·등급은 식약처 사전상담으로 확정한다.
//
// 문구는 messages/*.json 의 regulatory 네임스페이스에 있다. 여기에는 키·상태·색만 둔다.
// 인허가 문서 원문(정본)은 한국어를 기준으로 하며, 다른 언어는 참고 번역이다 — 05_용어집 참조.

/** 의도된 사용 명세(Intended Use) — 항목 키. 문구는 regulatory.intendedUse.* */
export const INTENDED_USE_KEYS = ["purpose", "users", "environment", "notIntended"] as const;

export type Track = "samd" | "wellness" | "review";

export interface FeatureClass {
  /** 메시지 키 — regulatory.feature.<key>.label | .likelihood | .basis */
  key: string;
  track: Track;
}

/** SaMD 후보 기능 식별 표 (문서1 1.2) */
export const FEATURE_CLASSIFICATION: FeatureClass[] = [
  { key: "risk_strat", track: "samd" },
  { key: "standard_grade", track: "samd" },
  { key: "explain_report", track: "samd" },
  { key: "measure_collect", track: "review" },
  { key: "lifestyle_content", track: "wellness" },
  { key: "gamification", track: "wellness" },
];

export const TRACK_COLOR: Record<Track, { color: string; bg: string }> = {
  samd: { color: "#a6541b", bg: "#FCEBDD" },
  wellness: { color: "#127a6e", bg: "#E1F3EF" },
  review: { color: "#6b21a8", bg: "#F3E8FF" },
};

/** 핵심 준비 문서 체크리스트 (문서1 1.5) */
export interface PrepDoc {
  /** regulatory.prepDoc.<key>.doc | .note */
  key: string;
  status: "ready" | "partial" | "todo";
}
export const PREP_DOCS: PrepDoc[] = [
  { key: "intended_use", status: "partial" },
  { key: "srs", status: "partial" },
  { key: "risk_mgmt", status: "todo" },
  { key: "lifecycle", status: "todo" },
  { key: "vnv", status: "partial" },
  { key: "clinical_eval", status: "todo" },
  { key: "cybersecurity", status: "partial" },
  { key: "usability", status: "todo" },
  { key: "labeling", status: "partial" },
];

/** 임상 검증·파일럿 단계 (문서4 4.2 / 상세실행판 Phase 4) */
export interface PilotPhase {
  /** regulatory.pilotPhase.<key>.phase | .goal */
  key: string;
  status: "done" | "active" | "todo";
}
export const PILOT_PHASES: PilotPhase[] = [
  { key: "internal", status: "active" },
  { key: "facility", status: "todo" },
  { key: "clinical", status: "todo" },
  { key: "submission", status: "todo" },
];

export const PREP_STATUS_COLOR: Record<PrepDoc["status"], string> = {
  ready: "#127a6e",
  partial: "#a6541b",
  todo: "#9ca3af",
};
export const PILOT_STATUS_COLOR: Record<PilotPhase["status"], string> = {
  done: "#127a6e",
  active: "#2E5A88",
  todo: "#9ca3af",
};
