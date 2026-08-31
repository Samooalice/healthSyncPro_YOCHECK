// 알림 생성 — 인앱 채널. 외부 채널(push/sms/kakao)은 발송 어댑터로 확장.
// 톤: 권고(상담 권유). 지시·응급 표현 금지. (참고: 세부데이터 E.3, tone-guidance)
// 문구는 care.notification_template(있으면)에서 렌더하고, 없으면 카탈로그 폴백.
//
// 다국어: notification 행에는 기준어(ko) 문장을 저장한다(발송 기록·감사용).
// 화면(알림함)은 template_id 와 참조 대상으로 현재 언어에서 다시 렌더한다
// (lib/care/notifyRender.ts). 그래서 템플릿 변수는 재구성 가능한 것만 쓴다.
import { prisma } from "@/lib/db";
import { translatorFor } from "@/i18n/translator";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { NOTIFY_TEMPLATES, type NotifyTemplateId } from "./notifyRender";

interface TopResult {
  disease: string;
  risk_grade: string;
  risk_score: number;
}

interface Rendered { title: string; body: string }

/**
 * notification_template(DB 운영 문구)이 있으면 그것으로, 없으면 카탈로그 폴백으로 렌더.
 * DB 템플릿은 운영자가 고칠 수 있는 한국어 원문이며, 다국어는 카탈로그가 담당한다.
 */
async function render(templateId: NotifyTemplateId, vars: Record<string, string>): Promise<Rendered> {
  const t = await translatorFor(DEFAULT_LOCALE);
  const spec = NOTIFY_TEMPLATES[templateId];
  const fallback: Rendered = {
    title: t(spec.title, vars),
    body: t(spec.body, vars),
  };
  try {
    const row = await prisma.notification_template.findUnique({ where: { id: templateId } });
    if (!row || row.active === false) return fallback;
    const interp = (s: string | null) => (s ?? "").replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
    return { title: interp(row.title) || fallback.title, body: interp(row.body) || fallback.body };
  } catch {
    return fallback;
  }
}

/** 분석 완료 시 알림 생성 — 결과 준비 + (주의↑) 위험 안내. */
export async function notifyAnalysis(userId: string, top: TopResult, assessmentId: string): Promise<void> {
  const t = await translatorFor(DEFAULT_LOCALE);
  const dz = t(`disease.${top.disease}`);

  const ready = await render("NT_RESULT_READY", {});
  await prisma.notification.create({
    data: {
      user_id: userId, template_id: "NT_RESULT_READY", channel: "inapp", category: "result",
      title: ready.title, body: ready.body, ref_type: "assessment", ref_id: assessmentId,
    },
  });

  if (top.risk_grade === "high" || top.risk_grade === "very_high") {
    const risk = await render("NT_RISK", { disease: dz });
    await prisma.notification.create({
      data: {
        user_id: userId, template_id: "NT_RISK", channel: "inapp", category: "risk",
        title: risk.title, body: risk.body, ref_type: "assessment", ref_id: assessmentId,
      },
    });
  }
}

/** 케어 액션·환류 등 단순 안내 알림 생성(변수 없음). */
export async function notifySimple(
  userId: string,
  templateId: NotifyTemplateId,
  category: string,
  ref: { type: string; id: string | null },
): Promise<void> {
  const r = await render(templateId, {});
  await prisma.notification.create({
    data: {
      user_id: userId, template_id: templateId, channel: "inapp", category,
      title: r.title, body: r.body, ref_type: ref.type, ref_id: ref.id,
    },
  });
}

export async function unreadCount(userId: string): Promise<number> {
  // RootLayout 에서 호출되므로, 클라이언트 미갱신 등 예외에도 전체 페이지가 죽지 않게 방어.
  try {
    return await prisma.notification.count({ where: { user_id: userId, read_at: null } });
  } catch {
    return 0;
  }
}
