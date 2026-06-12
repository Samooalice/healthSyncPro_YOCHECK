// 콘텐츠 참여 로그 (user_content_log) — 노출/조회/완료 이벤트 기록. 큐레이션·리텐션 분석용.
// 실패해도 화면 렌더를 막지 않도록 방어.
import { prisma } from "@/lib/db";

export type EngageEvent = "view" | "complete" | "impression";

export async function logEngagement(userId: string, contentId: string, event: EngageEvent): Promise<void> {
  try {
    await prisma.user_content_log.create({ data: { user_id: userId, content_id: contentId, event } });
  } catch {
    /* 로깅 실패 무시 */
  }
}
