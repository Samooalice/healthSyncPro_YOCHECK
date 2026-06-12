"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { CONSENT_VERSION } from "@/lib/auth/consent";

/** 선택 동의 변경 — append-only 새 이력으로 기록(최신값이 현재 상태). */
export async function updateConsent(formData: FormData): Promise<void> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  const type = String(formData.get("type") ?? "");
  const granted = formData.get("granted") === "true";
  if (!type) redirect("/me");
  await prisma.consent.create({
    data: { user_id: u.id, consent_type: type, granted, version: CONSENT_VERSION },
  });
  revalidatePath("/me");
}
