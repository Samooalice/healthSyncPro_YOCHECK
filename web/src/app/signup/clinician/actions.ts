"use server";

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

  if (!name || !email || !pw) return { error: "이름·이메일·비밀번호를 모두 입력하세요." };
  if (pw.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  if (!LICENSE_TYPES.includes(licenseType)) return { error: "면허 종류를 선택하세요." };
  if (!licenseNo) return { error: "면허(자격) 번호를 입력하세요." };
  if (!organization) return { error: "소속 의료기관을 입력하세요." };

  const consents = CLINICIAN_CONSENT_DEFS.map((d) => ({
    type: d.type,
    required: d.required,
    granted: formData.get(`consent_${d.type}`) === "on",
  }));
  if (!consents.filter((c) => c.required).every((c) => c.granted)) {
    return { error: "필수 동의·서약 항목에 동의해야 신청할 수 있습니다." };
  }

  const exists = await prisma.user_account.findFirst({ where: { email } });
  if (exists) return { error: "이미 가입(신청)된 이메일입니다." };

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
