// 감사 로그 (append-only) — PHI 접근·콘텐츠 게시·모델 배포 등 민감 행위 기록.
// 참고: 세부데이터 audit_log(view_phi|export|model_deploy...), 보안 13장.
import { prisma } from "@/lib/db";

export async function audit(
  actorId: string | null,
  action: string,
  target?: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.audit_log.create({
      data: { actor_id: actorId, action, target: target ?? null, detail: (detail ?? {}) as object },
    });
  } catch {
    // 감사 로깅 실패가 본 기능을 막지 않도록 방어
  }
}
