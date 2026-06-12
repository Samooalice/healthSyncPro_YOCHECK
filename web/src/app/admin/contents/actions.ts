"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

// 콘텐츠 상태기계 (세부데이터 8.2): draft→medical_review→ra_review→ready→published(↔unpublish)
const TRANSITIONS: Record<string, Record<string, unknown>> = {
  submit: { status: "medical_review", medical_review: "pending" },
  med_approve: { status: "ra_review", medical_review: "approved" },
  med_reject: { status: "draft", medical_review: "rejected" },
  ra_approve: { status: "ready" },
  ra_reject: { status: "draft" },
  publish: { status: "published", medical_review: "approved", published_at: new Date() },
  unpublish: { status: "ready", published_at: null },
};

export async function contentTransition(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  const data = TRANSITIONS[action];
  if (!id || !data) return;
  await prisma.content.update({ where: { id }, data });
  if (action === "publish") await audit(me.id, "content_publish", `content:${id}`);
  else if (action === "unpublish") await audit(me.id, "content_unpublish", `content:${id}`);
  revalidatePath("/admin/contents");
  revalidatePath("/admin");
}
