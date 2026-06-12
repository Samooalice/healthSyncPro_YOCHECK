"use server";

import { redirect } from "next/navigation";
import { clearSession, readSession } from "./session";

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}

/** 임퍼소네이트 중인 슈퍼가 계정 선택 화면으로 돌아가기. */
export async function backToSwitch(): Promise<void> {
  const s = await readSession();
  if (!s?.superId) redirect("/login");
  redirect("/switch");
}
