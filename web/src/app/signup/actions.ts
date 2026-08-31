"use server";

import { getTranslations } from "next-intl/server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/hash";
import { setSession } from "@/lib/auth/session";
import { CONSENT_DEFS, CONSENT_VERSION } from "@/lib/auth/consent";

export interface SignupState {
  error?: string;
}

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pw = String(formData.get("password") ?? "");

  const t = await getTranslations("authError");
  if (!name || !email || !pw) return { error: t("requiredFields") };
  if (pw.length < 8) return { error: t("passwordTooShort") };

  const consents = CONSENT_DEFS.map((d) => ({
    type: d.type,
    required: d.required,
    granted: formData.get(`consent_${d.type}`) === "on",
  }));
  if (!consents.filter((c) => c.required).every((c) => c.granted)) {
    return { error: t("consentRequired") };
  }

  const exists = await prisma.user_account.findFirst({ where: { email } });
  if (exists) return { error: t("emailTaken") };

  const pseudo = "b2c-" + crypto.randomBytes(6).toString("hex");
  const account = await prisma.$transaction(async (tx) => {
    const acct = await tx.user_account.create({
      data: { pseudo_id: pseudo, account_type: "b2c", email, display_name: name, password_hash: hashPassword(pw) },
    });
    // PII 분리 저장 (데모: 평문 바이트 — 운영 시 KMS 암호화)
    await tx.user_pii.create({ data: { user_id: acct.id, name_enc: Buffer.from(name, "utf8") } });
    // 동의 이력 (append-only)
    for (const c of consents) {
      await tx.consent.create({
        data: { user_id: acct.id, consent_type: c.type, granted: c.granted, version: CONSENT_VERSION },
      });
    }
    return acct;
  });

  await setSession({ uid: account.id });
  redirect("/onboarding");
}
