"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function markAllRead(): Promise<void> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  await prisma.notification.updateMany({ where: { user_id: u.id, read_at: null }, data: { read_at: new Date() } });
  revalidatePath("/alerts");
}
