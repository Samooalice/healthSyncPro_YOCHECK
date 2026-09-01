"use server";

import { getTranslations } from "next-intl/server";

import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/hash";
import { CLINICIAN_CONSENT_DEFS, CONSENT_VERSION } from "@/lib/auth/consent";
import { audit } from "@/lib/audit";

export interface ClinicianSignupState {
  error?: string;
  ok?: boolean;
}

const LICENSE_TYPES = ["doctor", "nurse", "medtech"];

export async function signupClinician(
  _prev: ClinicianSignupState,
  formData: FormData,
): Promise<ClinicianSignupState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pw = String(formData.get("password") ?? "");
  const licenseType = String(formData.get("license_type") ?? "");
  const licenseNo = String(formData.get("license_no") ?? "").trim();
  const organization = String(formData.get("organization") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  const t = await getTranslations("authError");
  if (!name || !email || !pw) return { error: t("requiredFields") };
  if (pw.length < 8) return { error: t("passwordTooShort") };
  if (!LICENSE_TYPES.includes(licenseType)) return { error: t("licenseTypeRequired") };
  if (!licenseNo) return { error: t("licenseNoRequired") };
  if (!organization) return { error: t("organizationRequired") };

  const consents = CLINICIAN_CONSENT_DEFS.map((d) => ({
    type: d.type,
    required: d.required,
    granted: formData.get(`consent_${d.type}`) === "on",
  }));
  if (!consents.filter((c) => c.required).every((c) => c.granted)) {
    return { error: t("clinicianConsentRequired") };
  }

  const exists = await prisma.user_account.findFirst({ where: { email } });
  if (exists) return { error: t("emailTakenClinician") };

  const pseudo = "clin-" + crypto.randomBytes(6).toString("hex");
  const account = await prisma.$transaction(async (tx) => {
    // 의료진 계정은 승인 전까지 'pending' (로그인 차단)
    const acct = await tx.user_account.create({
      data: {
        pseudo_id: pseudo, account_type: "clinician", status: "pending",
        email, display_name: name, password_hash: hashPassword(pw),
      },
    });
    await tx.user_pii.create({ data: { user_id: acct.id, name_enc: Buffer.from(name, "utf8") } });
    await tx.clinician_profile.create({
      data: { user_id: acct.id, license_type: licenseType, license_no: licenseNo, organization, department: department || null },
    });
    for (const c of consents) {
      await tx.consent.create({ data: { user_id: acct.id, consent_type: c.type, granted: c.granted, version: CONSENT_VERSION } });
    }
    return acct;
  });

  // 가입 신청 자체는 본인 행위 — 감사로그에 신청 기록(승인 대기)
  await audit(account.id, "clinician_signup", `clinician:${account.id}`, { organization, license_type: licenseType });

  // 자동 로그인하지 않음. 승인 대기 안내 화면으로.
  return { ok: true };
}
