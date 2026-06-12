// 알림 생성 — 인앱 채널. 외부 채널(push/sms/kakao)은 발송 어댑터로 확장.
// 톤: 권고(상담 권유). 지시·응급 표현 금지. (참고: 세부데이터 E.3, tone-guidance)
// 문구는 care.notification_template(있으면)에서 렌더하고, 없으면 인라인 폴백.
import { prisma } from "@/lib/db";

const DISEASE_KO: Record<string, string> = {
  kidney: "신장", diabetes: "당뇨", hypertension: "고혈압", uti: "요로감염", liver: "간담도",
};

interface TopResult {
  disease: string;
  risk_grade: string;
  risk_score: number;
}

interface Rendered { title: string; body: string }

/** notification_template에서 {var} 치환해 렌더. 템플릿 없으면 fallback 사용. */
async function render(templateId: string, vars: Record<string, string>, fallback: Rendered): Promise<Rendered> {
  try {
    const t = await prisma.notification_template.findUnique({ where: { id: templateId } });
    if (!t || t.active === false) return fallback;
    const interp = (s: string | null) => (s ?? "").replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
    return { title: interp(t.title) || fallback.title, body: interp(t.body) || fallback.body };
  } catch {
    return fallback;
  }
}

/** 분석 완료 시 알림 생성 — 결과 준비 + (주의↑) 위험 안내. */
export async function notifyAnalysis(userId: string, top: TopResult, assessmentId: string): Promise<void> {
  const dz = DISEASE_KO[top.disease] ?? top.disease;

  const ready = await render("NT_RESULT_READY", {}, {
    title: "검사 결과가 준비됐어요",
    body: "이번 측정 결과와 맞춤 케어를 확인해 보세요.",
  });
  await prisma.notification.create({
    data: {
      user_id: userId, template_id: "NT_RESULT_READY", channel: "inapp", category: "result",
      title: ready.title, body: ready.body, ref_type: "assessment", ref_id: assessmentId,
    },
  });

  if (top.risk_grade === "high" || top.risk_grade === "very_high") {
    const risk = await render("NT_RISK", { disease: dz }, {
      title: `${dz} 결과를 확인해 주세요`,
      body: `${dz} 관련 신호가 평소보다 높게 나왔어요. 결과를 자세히 확인하고, 필요하면 의료진과 상담해 보시길 권해요.`,
    });
    await prisma.notification.create({
      data: {
        user_id: userId, template_id: "NT_RISK", channel: "inapp", category: "risk",
        title: risk.title, body: risk.body, ref_type: "assessment", ref_id: assessmentId,
      },
    });
  }
}

/** 재측정 리마인더(케어 액션 due 기반 — 데모는 생성 시 즉시 안내). */
export async function notifyRecheck(userId: string, dueAt: Date | null): Promise<void> {
  const dueStr = dueAt ? new Date(dueAt).toLocaleDateString("ko-KR") : "";
  const r = await render("NT_RECHECK_DUE", { due: dueStr }, {
    title: "재측정을 권해요",
    body: dueAt
      ? `추세 확인을 위해 ${dueStr}까지 다시 한 번 측정해 보시길 권해요.`
      : "추세 확인을 위해 다시 한 번 측정해 보시길 권해요.",
  });
  await prisma.notification.create({
    data: {
      user_id: userId, template_id: "NT_RECHECK_DUE", channel: "inapp", category: "recheck",
      title: r.title, body: r.body, ref_type: "care_action", ref_id: null,
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
