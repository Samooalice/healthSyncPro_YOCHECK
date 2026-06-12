"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

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
  await prisma.notification.create({
    data: {
      user_id: u.id, template_id: "NT_REFERRAL", channel: "inapp", category: "care",
      title: "진료의뢰 요약이 준비됐어요",
      body: "의료진과 상담 시 참고할 수 있는 요약 리포트를 만들었어요. 케어 화면에서 확인할 수 있어요.",
      ref_type: "referral", ref_id: ref.id,
    },
  });
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
  await prisma.notification.create({
    data: {
      user_id: u.id, template_id: "NT_FEEDBACK", channel: "inapp", category: "info",
      title: "재측정 결과가 등록됐어요",
      body: "알려주신 결과는 분석 정확도 개선(재학습)에 반영돼요. 감사합니다.",
      ref_type: "assessment", ref_id: assessmentId,
    },
  });
  revalidatePath("/care");
}
