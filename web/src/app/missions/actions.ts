"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { completeMission } from "@/lib/gamification/engine";

export async function completeMissionAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  const key = String(formData.get("key") ?? "");
  if (!key) return;
  // 사용자의 대표 질환(미션 큐레이션 컨텍스트)
  const meas = await prisma.measurement.findFirst({ where: { user_id: me.id }, orderBy: { measured_at: "desc" } });
  const top = meas ? await prisma.risk_assessment.findFirst({ where: { measurement_id: meas.id }, orderBy: { risk_score: "desc" } }) : null;
  await completeMission(me.id, key, top?.disease ?? null);
  revalidatePath("/missions");
  revalidatePath("/dashboard");
}
