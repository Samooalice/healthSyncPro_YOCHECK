// 접근 제어 가드 — 서버 컴포넌트에서 호출. 미충족 시 redirect.
import { redirect } from "next/navigation";
import { getCurrentUser, roleHome } from "./session";

/** 로그인 필수. 미로그인 시 /login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 특정 역할 필수(슈퍼는 항상 허용). 권한 없으면 자기 역할 홈으로. */
export async function requireRole(roles: string[]) {
  const user = await requireUser();
  const allowed = user.is_super || roles.includes(user.account_type);
  if (!allowed) redirect(roleHome(user.account_type));
  return user;
}
