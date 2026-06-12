// 데모용 쿠키 세션 (HMAC 서명). 운영은 Supabase Auth 세션으로 교체.
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";

const COOKIE = "wc_session";
const SECRET = process.env.SESSION_SECRET || "dev-insecure-secret";

export interface SessionData {
  uid: string; // 현재 활동 계정(임퍼소네이트 대상 포함)
  superId?: string; // 슈퍼계정으로 로그인해 전환 중이면 슈퍼 계정 id
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** 서버 액션/라우트 핸들러에서만 호출 (쿠키 쓰기). */
export async function setSession(data: SessionData): Promise<void> {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const c = await cookies();
  c.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function readSession(): Promise<SessionData | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionData;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const s = await readSession();
  if (!s) return null;
  const u = await prisma.user_account.findUnique({ where: { id: s.uid } });
  if (!u) return null;
  return Object.assign(u, { impersonatedBySuper: !!s.superId });
}

export function roleHome(accountType: string): string {
  if (accountType === "clinician") return "/clinician/patients";
  if (accountType === "admin") return "/admin";
  return "/dashboard";
}
