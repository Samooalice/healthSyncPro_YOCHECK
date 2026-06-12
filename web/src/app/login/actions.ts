"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/hash";
import { setSession, roleHome } from "@/lib/auth/session";
import { rateLimit, rateLimitReset } from "@/lib/security/rateLimit";
import { audit } from "@/lib/audit";
import { log } from "@/lib/observability/log";

export interface LoginState {
  error?: string;
}

const LIMIT = 5;          // 5회
const WINDOW = 10 * 60_000; // 10분

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pw = String(formData.get("password") ?? "");

  // 레이트 리밋 — 이메일+클라이언트IP 기준 (자격증명 스터핑·무차별 대입 완화)
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const key = `login:${email}:${ip}`;
  const rl = rateLimit(key, LIMIT, WINDOW);
  if (!rl.allowed) {
    await audit(null, "login_blocked", `email:${email}`, { ip, retryAfterSec: rl.retryAfterSec });
    log.warn("login_rate_limited", { email, ip, retryAfterSec: rl.retryAfterSec });
    return { error: `로그인 시도가 많습니다. ${Math.ceil(rl.retryAfterSec / 60)}분 후 다시 시도해 주세요.` };
  }

  const user = await prisma.user_account.findFirst({ where: { email } });
  if (!user || !verifyPassword(pw, user.password_hash)) {
    await audit(user?.id ?? null, "login_failed", `email:${email}`, { ip });
    log.warn("login_failed", { email, ip });
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  // 의료진 승인 게이트: 승인 전(pending)·반려·정지 계정은 로그인 차단
  if (user.account_type === "clinician" && user.status !== "active") {
    if (user.status === "pending") return { error: "가입 신청이 관리자 승인 대기 중입니다. 승인 후 로그인할 수 있어요." };
    if (user.status === "rejected") return { error: "가입 신청이 반려되었습니다. 관리자에게 문의해 주세요." };
    return { error: "이용이 제한된 계정입니다. 관리자에게 문의해 주세요." };
  }

  // 성공 — 카운터 리셋 + 감사 기록
  rateLimitReset(key);
  await audit(user.id, "login", `user:${user.id}`, { ip });
  log.info("login_success", { uid: user.id, role: user.account_type, ip });

  if (user.is_super) {
    await setSession({ uid: user.id, superId: user.id });
    redirect("/switch");
  }

  await setSession({ uid: user.id });
  redirect(roleHome(user.account_type));
}
