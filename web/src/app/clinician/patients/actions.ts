"use server";

import { getTranslations } from "next-intl/server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/hash";
import { CONSENT_DEFS, CONSENT_VERSION } from "@/lib/auth/consent";
import { audit } from "@/lib/audit";
import { isStaff } from "@/lib/auth/careTeam";

export interface RegisterPatientState {
  error?: string;
}

/**
 * 의료진이 환자 계정을 대리 생성한다(내원 환자 등록).
 * 환자는 발급받은 이메일·비밀번호로 직접 로그인할 수도 있다.
 * 동의는 환자 본인에게 확인받은 항목만 기록한다(필수 동의 미확인 시 등록 불가).
 */
export async function registerPatient(_prev: RegisterPatientState, formData: FormData): Promise<RegisterPatientState> {
  const me = await getCurrentUser();
  const t = await getTranslations("authError");
  if (!me || !isStaff(me)) {
    return { error: t("clinicianOnly") };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pw = String(formData.get("password") ?? "");
  const sexRaw = String(formData.get("sex") ?? "");
  const sex = sexRaw === "M" || sexRaw === "F" ? sexRaw : null;
  const birthRaw = String(formData.get("birth_year") ?? "").trim();
  const birthYear = birthRaw ? Number(birthRaw) : null;

  if (!name || !email || !pw) return { error: t("requiredFields") };
  if (pw.length < 8) return { error: t("passwordTooShort") };
  if (birthYear != null && (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear())) {
    return { error: t("birthYearInvalid") };
  }

  const consents = CONSENT_DEFS.map((d) => ({
    type: d.type,
    required: d.required,
    granted: formData.get(`consent_${d.type}`) === "on",
  }));
  if (!consents.filter((c) => c.required).every((c) => c.granted)) {
    return { error: t("patientConsentRequired") };
  }

  const exists = await prisma.user_account.findFirst({ where: { email } });
  if (exists) return { error: t("emailTaken") };

  const pseudo = "b2c-" + crypto.randomBytes(6).toString("hex");
  const account = await prisma.$transaction(async (tx) => {
    const acct = await tx.user_account.create({
      data: { pseudo_id: pseudo, account_type: "b2c", email, display_name: name, password_hash: hashPassword(pw) },
    });
    // PII 분리 저장 (데모: 평문 바이트 — 운영 시 KMS 암호화)
    await tx.user_pii.create({
      data: { user_id: acct.id, name_enc: Buffer.from(name, "utf8"), sex, birth_year: birthYear },
    });
    // 동의 이력 (append-only)
    for (const c of consents) {
      await tx.consent.create({
        data: { user_id: acct.id, consent_type: c.type, granted: c.granted, version: CONSENT_VERSION },
      });
    }
    // 등록한 의료진과 담당 관계 연결 — 이 환자는 등록한 의료진의 포털에만 나타난다
    await tx.clinician_patient.create({
      data: { clinician_id: me.id, patient_id: acct.id, source: "registered", linked_by: me.id },
    });
    return acct;
  });

  await audit(me.id, "patient_register", `patient:${account.id}`, { pseudo_id: pseudo });
  redirect(`/clinician/patients/${account.id}`);
}
