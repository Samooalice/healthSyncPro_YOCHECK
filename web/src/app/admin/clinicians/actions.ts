"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

export async function approveClinician(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.$transaction([
    prisma.user_account.update({ where: { id }, data: { status: "active" } }),
    prisma.clinician_profile.update({ where: { user_id: id }, data: { verified: true, verified_by: me.id, verified_at: new Date(), reject_reason: null } }),
  ]);
  await audit(me.id, "clinician_verify", `clinician:${id}`, { result: "approved" });
  revalidatePath("/admin/clinicians");
  revalidatePath("/admin");
}

export async function rejectClinician(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "사유 미기재";
  if (!id) return;
  await prisma.$transaction([
    prisma.user_account.update({ where: { id }, data: { status: "rejected" } }),
    prisma.clinician_profile.update({ where: { user_id: id }, data: { verified: false, verified_by: me.id, verified_at: new Date(), reject_reason: reason } }),
  ]);
  await audit(me.id, "clinician_verify", `clinician:${id}`, { result: "rejected", reason });
  revalidatePath("/admin/clinicians");
  revalidatePath("/admin");
}
