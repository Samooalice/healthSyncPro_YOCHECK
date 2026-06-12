// 게이미피케이션 엔진 (7.7) — 포인트·스트릭·뱃지·미션 적립. 측정 파이프라인/미션 액션에서 호출.
import { prisma } from "@/lib/db";
import { POINTS, BADGE_MAP, dailyMissions, type MissionDef } from "./catalog";

export interface GamState {
  points: number;
  streak_days: number;
  badges: string[];
  goals: string[];
}

function todayStr(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** 상태 조회(없으면 생성). badges/goals는 문자열 배열로 정규화. */
export async function getState(userId: string): Promise<GamState> {
  const row = await prisma.gamification_state.upsert({
    where: { user_id: userId }, update: {}, create: { user_id: userId },
  });
  const badges = Array.isArray(row.badges) ? (row.badges as unknown[]).map(String) : [];
  const goals = Array.isArray(row.goals) ? (row.goals as unknown[]).map(String) : [];
  return { points: row.points ?? 0, streak_days: row.streak_days ?? 0, badges, goals };
}

/** 측정일(로컬 날짜) 집합으로 연속 스트릭 계산 — 오늘 또는 어제에서 거슬러 연속 일수. */
export function computeStreak(dates: Date[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => todayStr(d)));
  // 시작점: 오늘 측정 있으면 오늘, 없고 어제 있으면 어제, 둘 다 없으면 0
  const today = new Date();
  const yest = new Date(Date.now() - 86400_000);
  let cursor: Date;
  if (days.has(todayStr(today))) cursor = today;
  else if (days.has(todayStr(yest))) cursor = yest;
  else return 0;
  let streak = 0;
  while (days.has(todayStr(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400_000);
  }
  return streak;
}

/** 오늘의 미션 + 완료 여부 */
export async function todayMissions(userId: string, disease?: string | null): Promise<{ def: MissionDef; done: boolean }[]> {
  const defs = dailyMissions(disease);
  const logs = await prisma.mission_log.findMany({ where: { user_id: userId, mission_date: new Date(todayStr()) } });
  const doneKeys = new Set(logs.map((l) => l.mission_key));
  return defs.map((def) => ({ def, done: doneKeys.has(def.key) }));
}

/** 미션 완료(멱등). 이미 오늘 완료했으면 무시. 포인트·뱃지 갱신. */
export async function completeMission(userId: string, missionKey: string, disease?: string | null): Promise<void> {
  const defs = dailyMissions(disease);
  if (!defs.some((d) => d.key === missionKey)) return; // 카탈로그 외 키 거부
  try {
    await prisma.mission_log.create({
      data: { user_id: userId, mission_key: missionKey, mission_date: new Date(todayStr()), points: POINTS.mission },
    });
  } catch {
    return; // UNIQUE 충돌 = 이미 완료 → 멱등 종료
  }
  const st = await getState(userId);
  let points = st.points + POINTS.mission;
  const badges = [...st.badges];
  // 미션 누적 10회 → 미션 마스터
  const totalMissions = await prisma.mission_log.count({ where: { user_id: userId } });
  if (totalMissions >= 10 && !badges.includes("mission_master")) { badges.push("mission_master"); points += POINTS.badge; }
  await prisma.gamification_state.update({ where: { user_id: userId }, data: { points, badges, updated_at: new Date() } });
}

/** 새 측정 적립 — 스트릭 재계산·측정 포인트·뱃지(첫측정·연속·위험개선). 파이프라인에서 호출. */
export async function awardMeasurement(userId: string): Promise<void> {
  const measurements = await prisma.measurement.findMany({
    where: { user_id: userId }, orderBy: { measured_at: "desc" }, take: 90, select: { measured_at: true },
  });
  const streak = computeStreak(measurements.map((m) => m.measured_at));

  const st = await getState(userId);
  let points = st.points + POINTS.measurement;
  const badges = [...st.badges];
  const add = (key: string) => { if (!badges.includes(key)) { badges.push(key); points += POINTS.badge; } };

  if (measurements.length >= 1) add("first_measure");
  if (streak >= 3) add("streak_3");
  if (streak >= 7) add("streak_7");
  if (streak >= 30) add("streak_30");

  // 위험 개선 뱃지 — 최근 두 측정의 대표(최고위험) 위험점수 비교
  const recentMeas = await prisma.measurement.findMany({ where: { user_id: userId }, orderBy: { measured_at: "desc" }, take: 2, select: { id: true } });
  if (recentMeas.length === 2) {
    const [cur, prev] = await Promise.all(recentMeas.map((m) =>
      prisma.risk_assessment.findFirst({ where: { measurement_id: m.id }, orderBy: { risk_score: "desc" }, select: { risk_score: true } }),
    ));
    if (cur && prev && Number(cur.risk_score) < Number(prev.risk_score) - 0.02) add("risk_improved");
  }

  await prisma.gamification_state.update({ where: { user_id: userId }, data: { points, streak_days: streak, badges, updated_at: new Date() } });
}

export { BADGE_MAP };
