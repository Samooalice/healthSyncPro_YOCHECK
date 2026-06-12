// 기존 b2c 사용자 게이미피케이션 상태 백필 (측정 이력 기반 스트릭·포인트·뱃지).
// 게이미피케이션 훅 이전에 적재된 측정에 대해 1회 초기화. 멱등(현재값과 무관하게 재계산).
import { prisma } from "../src/lib/db";
import { computeStreak } from "../src/lib/gamification/engine";
import { POINTS } from "../src/lib/gamification/catalog";

const users = await prisma.user_account.findMany({ where: { account_type: "b2c" }, select: { id: true, display_name: true, pseudo_id: true } });
for (const u of users) {
  const meas = await prisma.measurement.findMany({ where: { user_id: u.id }, orderBy: { measured_at: "asc" }, select: { id: true, measured_at: true } });
  if (meas.length === 0) continue;
  const streak = computeStreak(meas.map((m) => m.measured_at));
  const badges: string[] = ["first_measure"];
  if (streak >= 3) badges.push("streak_3");
  if (streak >= 7) badges.push("streak_7");
  if (streak >= 30) badges.push("streak_30");
  // 위험 개선(최근 2측정 대표 위험점수 비교)
  if (meas.length >= 2) {
    const last2 = meas.slice(-2);
    const [prev, cur] = await Promise.all(last2.map((m) => prisma.risk_assessment.findFirst({ where: { measurement_id: m.id }, orderBy: { risk_score: "desc" }, select: { risk_score: true } })));
    if (cur && prev && Number(cur.risk_score) < Number(prev.risk_score) - 0.02) badges.push("risk_improved");
  }
  const points = meas.length * POINTS.measurement + badges.length * POINTS.badge;
  await prisma.gamification_state.upsert({
    where: { user_id: u.id },
    update: { points, streak_days: streak, badges, updated_at: new Date() },
    create: { user_id: u.id, points, streak_days: streak, badges },
  });
  console.log(`${u.display_name ?? u.pseudo_id}: 측정 ${meas.length} · 스트릭 ${streak} · ${points}P · 뱃지 [${badges.join(",")}]`);
}
console.log("백필 완료");
process.exit(0);
