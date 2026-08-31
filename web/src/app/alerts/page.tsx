// 알림 (9.1) — 인앱 알림 목록·읽음 처리. (Step 4 케어 폐루프)
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { localizeNotification } from "@/lib/care/notifyRender";
import { fmtDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import { markAllRead } from "./actions";

export const dynamic = "force-dynamic";

// 알림 분류 → 색. 라벨은 alertCategory.* 카탈로그.
const CAT_COLOR: Record<string, string> = {
  result: "#2E5A88",
  risk: "#D4691B",
  recheck: "#C79100",
  care: "#1a8f84",
  info: "#6b7280",
};

export default async function AlertsPage() {
  const me = await requireUser();
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const items = await prisma.notification.findMany({
    where: { user_id: me.id }, orderBy: { created_at: "desc" }, take: 50,
  });
  const unread = items.filter((i) => !i.read_at).length;

  // NT_RISK 문구 재구성용 — 참조된 평가의 질환 코드를 한 번에 조회한다.
  const assessmentIds = [...new Set(
    items.filter((i) => i.ref_type === "assessment" && i.ref_id).map((i) => i.ref_id as string),
  )];
  const assessments = assessmentIds.length
    ? await prisma.risk_assessment.findMany({ where: { id: { in: assessmentIds } }, select: { id: true, disease: true } })
    : [];
  const diseaseByAssessment = new Map(assessments.map((a) => [a.id, a.disease]));

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">{t("nav.alerts")} {unread > 0 && <span className="text-sm text-[#D4691B]">{unread}</span>}</h1>
        {unread > 0 && (
          <form action={markAllRead}>
            <button type="submit" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-body transition hover:text-ink">{t("alerts.markAllRead")}</button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
          {t("alerts.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const cat = n.category in CAT_COLOR ? n.category : "info";
            const color = CAT_COLOR[cat];
            const href = n.ref_type === "assessment" && n.ref_id ? `/result/${n.ref_id}` : null;
            const text = localizeNotification(t, n, diseaseByAssessment);
            const inner = (
              <div className="flex items-start gap-3 rounded-2xl border bg-white p-4"
                style={{ borderColor: n.read_at ? "#eef0f2" : color + "55", background: n.read_at ? "#fff" : "#fcfbf8" }}>
                <span className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: color }}>{t(`alertCategory.${cat}`)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />}
                    <span className="text-sm font-semibold text-gray-800">{text.title}</span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{text.body}</p>
                  <div className="mt-1 text-[11px] text-gray-400">{fmtDateTime(locale, n.created_at)}</div>
                </div>
              </div>
            );
            return href ? <Link key={n.id} href={href} className="block">{inner}</Link> : <div key={n.id}>{inner}</div>;
          })}
        </div>
      )}
      <p className="mt-4 text-center text-xs text-gray-400">{t("alerts.note")}</p>
    </main>
  );
}
