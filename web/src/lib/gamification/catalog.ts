// 게이미피케이션 카탈로그 (7.7) — 미션·뱃지·포인트 정의. 동기부여 톤(비진단·비강요).
// 포인트는 활동 적립이며, 건강생활실천지원금 연계는 정책 검토 단계(확정 보상 아님).

export const POINTS = { measurement: 20, mission: 10, badge: 30 } as const;

export interface MissionDef {
  key: string;
  label: string;
  tip: string;
}

// 공통 일일 미션 + 질환별 보강 (lifestyle 체크리스트 연동, 7.4.3)
const COMMON: MissionDef[] = [
  { key: "water", label: "물 1.5L 마시기", tip: "조금씩 자주 마시면 신장·요로 건강에 도움이 돼요." },
  { key: "walk", label: "가볍게 20분 걷기", tip: "식후 가벼운 걷기는 혈당·혈압 관리에 좋아요." },
  { key: "salt", label: "짠 음식 줄이기", tip: "국물·가공식품의 나트륨을 줄여보세요." },
];
const BY_DISEASE: Record<string, MissionDef[]> = {
  kidney: [
    { key: "water", label: "물 1.5L 마시기", tip: "수분은 신장 노폐물 배출을 도와요." },
    { key: "salt", label: "국물·짠 음식 줄이기", tip: "나트륨 제한은 단백뇨·혈압 관리에 도움돼요." },
    { key: "protein_care", label: "과한 단백 보충제 점검", tip: "신장에 부담될 수 있어 적정량을 확인해요." },
  ],
  diabetes: [
    { key: "sugar", label: "단 음료 대신 물 마시기", tip: "당 섭취를 줄이면 혈당 변동이 완만해져요." },
    { key: "walk", label: "식후 20분 걷기", tip: "식후 활동은 혈당 스파이크를 낮춰요." },
    { key: "carb_care", label: "정제 탄수화물 줄이기", tip: "흰쌀·밀가루 대신 통곡물을 골라보세요." },
  ],
  hypertension: [
    { key: "salt", label: "저염 식단 실천", tip: "나트륨을 줄이면 혈압 관리에 직접 도움돼요." },
    { key: "walk", label: "유산소 20분", tip: "규칙적 유산소는 혈압을 낮추는 데 좋아요." },
    { key: "bp_check", label: "가정 혈압 기록", tip: "같은 시간대에 측정해 추세를 살펴요." },
  ],
  uti: [
    { key: "water", label: "물 충분히 마시기", tip: "수분 섭취는 세균 배출을 도와요." },
    { key: "hold_less", label: "소변 참지 않기", tip: "규칙적인 배뇨가 요로 건강에 좋아요." },
    { key: "hygiene", label: "위생 습관 점검", tip: "기본 위생 관리로 재발을 줄여요." },
  ],
};

export function dailyMissions(disease?: string | null): MissionDef[] {
  return (disease && BY_DISEASE[disease]) || COMMON;
}

export interface BadgeDef {
  key: string;
  label: string;
  desc: string;
  icon: string; // 이모지(간단 표시)
}

export const BADGES: BadgeDef[] = [
  { key: "first_measure", label: "첫 걸음", desc: "첫 측정을 완료했어요", icon: "🩺" },
  { key: "streak_3", label: "3일 연속", desc: "3일 연속 측정", icon: "🔥" },
  { key: "streak_7", label: "한 주 완주", desc: "7일 연속 측정", icon: "🏅" },
  { key: "streak_30", label: "한 달 습관", desc: "30일 연속 측정", icon: "👑" },
  { key: "mission_master", label: "미션 마스터", desc: "미션 누적 10회 완료", icon: "✅" },
  { key: "risk_improved", label: "개선의 시작", desc: "위험도가 이전보다 낮아졌어요", icon: "📉" },
];

export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(BADGES.map((b) => [b.key, b]));

// 질환별 건강 목표 제안 (goals 큐레이션)
export const GOAL_SUGGESTION: Record<string, string> = {
  kidney: "요단백 음성 유지하기",
  diabetes: "요당 음성·혈당 안정 유지",
  hypertension: "혈압·단백뇨 안정 유지",
  uti: "백혈구·아질산염 음성 회복",
  liver: "빌리루빈 정상 유지",
};
