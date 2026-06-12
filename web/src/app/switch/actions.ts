"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readSession, setSession, roleHome } from "@/lib/auth/session";

export async function switchTo(formData: FormData): Promise<void> {
  const s = await readSession();
  if (!s?.superId) redirect("/login");

  const targetId = String(formData.get("id") ?? "");
  const target = await prisma.user_account.findUnique({ where: { id: targetId } });
  if (!target) redirect("/switch");

  // 슈퍼 자격 유지한 채 대상 계정으로 활동 전환(임퍼소네이트)
  await setSession({ uid: target.id, superId: s!.superId });
  redirect(roleHome(target.account_type));
}
