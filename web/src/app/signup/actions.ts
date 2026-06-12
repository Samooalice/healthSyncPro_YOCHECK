"use server";

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

  if (!name || !email || !pw) return { error: "이름·이메일·비밀번호를 모두 입력하세요." };
  if (pw.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };

  const consents = CONSENT_DEFS.map((d) => ({
    type: d.type,
    required: d.required,
    granted: formData.get(`consent_${d.type}`) === "on",
  }));
  if (!consents.filter((c) => c.required).every((c) => c.granted)) {
    return { error: "필수 동의 항목에 동의해야 가입할 수 있습니다." };
  }

  const exists = await prisma.user_account.findFirst({ where: { email } });
  if (exists) return { error: "이미 가입된 이메일입니다." };

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
