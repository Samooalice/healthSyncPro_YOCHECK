// E2E 스모크 테스트 (파일럿 준비·V&V) — 사용자 여정 전 구간을 실DB로 검증.
// 가입→동의→측정→분석(다질환·설명)→케어액션→게이미피케이션→알림→미션완료.
// 일회성 테스트 계정을 생성하고 종료 시 cascade 삭제한다.
// 실행: npx tsx --env-file=.env.local scripts/e2e-smoke.mts
import crypto from "node:crypto";
import { prisma } from "../src/lib/db";
import { runAnalysis } from "../src/lib/analysis/pipeline";
import { completeMission, getState } from "../src/lib/gamification/engine";
import { hashPassword } from "../src/lib/auth/hash";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const email = `__e2e_${crypto.randomBytes(4).toString("hex")}@smoke.test`;
const pseudo = "e2e-" + crypto.randomBytes(5).toString("hex");
let userId = "";

try {
  console.log("\n[1] 가입·동의");
  const acct = await prisma.$transaction(async (tx) => {
    const u = await tx.user_account.create({ data: { pseudo_id: pseudo, account_type: "b2c", email, display_name: "스모크", password_hash: hashPassword("smoke1234") } });
    await tx.user_pii.create({ data: { user_id: u.id, name_enc: Buffer.from("스모크", "utf8"), birth_year: 1970, sex: "M" } });
    await tx.consent.create({ data: { user_id: u.id, consent_type: "sensitive_health", granted: true, version: "v1.0" } });
    return u;
  });
  userId = acct.id;
  const consents = await prisma.consent.count({ where: { user_id: userId, granted: true } });
  check("계정 생성", !!userId);
  check("필수 동의 기록", consents >= 1, `${consents}건`);

  console.log("[2] 측정→분석 파이프라인 (당뇨 위험 시나리오)");
  // 요당 4+ + (PHR 없음) → 다질환 분석. 룰 엔진/ML 어느 쪽이든 평가 생성돼야 함.
  const res = await runAnalysis({ userId, raw: { glucose: 4, protein: 2, blood: 0, leukocyte: 0, nitrite: 0, ketone: 1, bilirubin: 0, urobilinogen: 0.2, specific_gravity: 1.02, ph: 6, vitamin_c: 0 }, source: "analyzer" });
  check("측정 저장", !!res.measurement_id);
  check("대표 위험질환 산출", !!res.disease, `${res.disease} ${res.risk_grade} ${res.risk_score.toFixed(2)}`);
  check("다질환 평가(≥1)", res.diseases.length >= 1, `${res.diseases.length}개 질환`);

  console.log("[3] 설명(P4)·근거 저장");
  const exp = await prisma.explanation.findUnique({ where: { assessment_id: res.assessment_id } });
  check("설명 텍스트(사용자/임상)", !!exp && !!exp.text_user && !!exp.text_clinician);
  check("SHAP 근거 존재", !!exp && Array.isArray(exp.shap_values));

  console.log("[4] 케어액션(P5)");
  const care = await prisma.care_action.count({ where: { assessment_id: res.assessment_id } });
  check("케어액션 생성", care >= 1, `${care}건`);

  console.log("[5] 알림");
  const notif = await prisma.notification.count({ where: { user_id: userId } });
  check("결과/위험 알림 생성", notif >= 1, `${notif}건`);

  console.log("[6] 게이미피케이션 적립");
  const g1 = await getState(userId);
  check("측정 포인트 적립", g1.points >= 20, `${g1.points}P`);
  check("첫 측정 뱃지", g1.badges.includes("first_measure"));

  console.log("[7] 미션 완료 → 포인트 증가");
  const missionKey = res.disease === "diabetes" ? "sugar" : res.disease === "kidney" ? "water" : "walk";
  await completeMission(userId, missionKey, res.disease);
  const g2 = await getState(userId);
  check("미션 포인트 +10", g2.points === g1.points + 10, `${g1.points}→${g2.points}`);

  console.log("[8] 트랙 분리 플래그(SaMD)");
  const samd = await prisma.risk_assessment.count({ where: { measurement_id: res.measurement_id, is_samd_output: true } });
  check("SaMD 출력 플래깅", samd >= 1, `${samd}건`);

} catch (e) {
  fail++;
  console.error("  ✗ 예외:", (e as Error).message);
} finally {
  if (userId) { await prisma.user_account.delete({ where: { id: userId } }).catch(() => {}); console.log("\n정리: 테스트 계정 삭제"); }
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail === 0 ? 0 : 1);
