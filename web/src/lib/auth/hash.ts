// 데모용 비밀번호 해시 (scrypt, 의존성 없음). 운영은 Supabase Auth로 교체.
import crypto from "node:crypto";

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(pw, salt, 32).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, derived] = stored.split(":");
  if (!salt || !derived) return false;
  const calc = crypto.scryptSync(pw, salt, 32);
  const known = Buffer.from(derived, "hex");
  return known.length === calc.length && crypto.timingSafeEqual(known, calc);
}
