// 게이미피케이션 카탈로그 (7.7) — 미션·뱃지·포인트 정의. 동기부여 톤(비진단·비강요).
// 포인트는 활동 적립이며, 건강생활실천지원금 연계는 정책 검토 단계(확정 보상 아님).
//
// 문구는 messages/*.json 의 mission / badge / goal 네임스페이스에 있다.
// 미션 키(water, walk, salt …)는 질환 세트마다 안내 문구가 달라서 DB 키만으로는
// 메시지를 특정할 수 없다. 그래서 세트(set)까지 포함한 경로를 messagePath 로 만든다.
// DB(mission_log.mission_key)에 저장되는 값은 종전대로 key 뿐이다.

export const POINTS = { measurement: 20, mission: 10, badge: 30 } as const;

export type MissionSet = "common" | "kidney" | "diabetes" | "hypertension" | "uti";

export interface MissionDef {
  key: string;
  set: MissionSet;
}

const SET_KEYS: Record<MissionSet, string[]> = {
  common: ["water", "walk", "salt"],
  kidney: ["water", "salt", "protein_care"],
  diabetes: ["sugar", "walk", "carb_care"],
  hypertension: ["salt", "walk", "bp_check"],
  uti: ["water", "hold_less", "hygiene"],
};

function defs(set: MissionSet): MissionDef[] {
  return SET_KEYS[set].map((key) => ({ key, set }));
}

export function dailyMissions(disease?: string | null): MissionDef[] {
  const set: MissionSet = disease && disease in SET_KEYS ? (disease as MissionSet) : "common";
  return defs(set);
}

/** 미션 라벨/설명 메시지 경로 — mission.<set>.<key>.label | .tip */
export function missionLabelKey(m: MissionDef): string {
  return `mission.${m.set}.${m.key}.label`;
}
export function missionTipKey(m: MissionDef): string {
  return `mission.${m.set}.${m.key}.tip`;
}

export interface BadgeDef {
  key: string;
  icon: string; // 이모지(간단 표시) — 언어 무관
}

export const BADGES: BadgeDef[] = [
  { key: "first_measure", icon: "🩺" },
  { key: "streak_3", icon: "🔥" },
  { key: "streak_7", icon: "🏅" },
  { key: "streak_30", icon: "👑" },
  { key: "mission_master", icon: "✅" },
  { key: "risk_improved", icon: "📉" },
];

export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(BADGES.map((b) => [b.key, b]));

/** 질환별 건강 목표 제안 (goals 큐레이션) — 문구는 goal.<disease> */
export const GOAL_DISEASES = ["kidney", "diabetes", "hypertension", "uti", "liver"] as const;

export function goalKey(disease: string | null | undefined): string | null {
  return disease && (GOAL_DISEASES as readonly string[]).includes(disease)
    ? `goal.${disease}`
    : null;
}
