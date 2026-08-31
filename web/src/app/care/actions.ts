"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { notifySimple } from "@/lib/care/notify";

async function me() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** 케어 액션 완료 처리. */
export async function completeCareAction(formData: FormData): Promise<void> {
  const u = await me();
  const id = String(formData.get("id") ?? "");
  await prisma.care_action.updateMany({ where: { id, user_id: u.id }, data: { status: "done" } });
  revalidatePath("/care");
}

/** 진료의뢰 리포트 생성 (P5) — referral 레코드 + 안내 알림. */
export async function createReferral(formData: FormData): Promise<void> {
  const u = await me();
  const assessmentId = String(formData.get("assessment_id") ?? "") || null;
  const ref = await prisma.referral.create({
    data: { user_id: u.id, assessment_id: assessmentId, status: "created" },
  });
  await notifySimple(u.id, "NT_REFERRAL", "care", { type: "referral", id: ref.id });
  revalidatePath("/care");
}

/** 환류(재측정 결과) 등록 → feedback_label 저장(재학습 데이터). */
export async function registerFeedback(formData: FormData): Promise<void> {
  const u = await me();
  const assessmentId = String(formData.get("assessment_id") ?? "") || null;
  const outcome = String(formData.get("outcome") ?? "stable"); // improved|stable|worsened
  await prisma.feedback_label.create({
    data: { user_id: u.id, assessment_id: assessmentId, label_type: "recheck_result", label_value: { outcome } },
  });
  await notifySimple(u.id, "NT_FEEDBACK", "info", { type: "assessment", id: assessmentId });
  revalidatePath("/care");
}
