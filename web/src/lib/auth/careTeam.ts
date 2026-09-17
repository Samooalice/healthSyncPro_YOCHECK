// 의료진 ↔ 환자 담당 관계 (care.clinician_patient).
// 개인 가입자는 어떤 의료진에게도 자동 노출되지 않는다 — 연결된 환자만 조회·측정 가능.
// 관리자/슈퍼는 운영 감독 목적으로 전체 조회(접근은 audit_log 로 기록).
import { prisma } from "@/lib/db";

interface Viewer {
  id: string;
  account_type: string;
  is_super: boolean;
}

/** 전체 환자를 볼 수 있는 계정인가 (관리자·슈퍼). */
export function seesAllPatients(me: Viewer): boolean {
  return me.is_super || me.account_type === "admin";
}

/** 의료진 포털에서 다룰 수 있는 역할인가. */
export function isStaff(me: Viewer): boolean {
  return seesAllPatients(me) || me.account_type === "clinician";
}

/** 환자 목록 조회용 user_account where 절. */
export function patientScope(me: Viewer) {
  return seesAllPatients(me)
    ? { account_type: "b2c" }
    : { account_type: "b2c", clinicians: { some: { clinician_id: me.id } } };
}

/** 이 환자에 접근할 수 있는가 (b2c 이면서 담당 관계가 있거나, 관리자·슈퍼). */
export async function canAccessPatient(me: Viewer, patientId: string): Promise<boolean> {
  if (!isStaff(me)) return false;
  const patient = await prisma.user_account.findFirst({ where: { id: patientId, ...patientScope(me) }, select: { id: true } });
  return !!patient;
}
