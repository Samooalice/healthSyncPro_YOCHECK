// 케어 (9.1 / P5) — 케어 액션(완료처리)·진료의뢰 생성·재측정 결과 환류.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { careLabel } from "@/lib/ui/labels";
import { fmtDate } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import { completeCareAction, createReferral, registerFeedback } from "./actions";

export const dynamic = "force-dynamic";

const ACTION_STATUS = ["assigned", "in_progress", "done", "expired"];
const FEEDBACK_OUTCOMES: [string, string][] = [
  ["improved", "#2E9E5B"],
  ["stable", "#6b7280"],
  ["worsened", "#D4691B"],
];

export default async function CarePage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const [actions, referrals, latestMeas] = await Promise.all([
    prisma.care_action.findMany({ where: { user_id: user.id }, orderBy: { created_at: "desc" }, take: 50 }),
    prisma.referral.findMany({ where: { user_id: user.id }, orderBy: { created_at: "desc" }, take: 10 }),
    prisma.measurement.findFirst({ where: { user_id: user.id }, orderBy: { measured_at: "desc" } }),
  ]);
  const topAssessment = latestMeas
    ? await prisma.risk_assessment.findFirst({ where: { measurement_id: latestMeas.id }, orderBy: { risk_score: "desc" } })
    : null;

  const statusLabelOf = (s: string | null) =>
    s && ACTION_STATUS.includes(s) ? t(`careStatus.${s}`) : (s ?? "");

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-5 text-xl font-bold text-ink">{t("nav.care")}</h1>

      {/* 케어 액션 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">{t("result.careTitle")}</h2>
        {actions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            <p>{t("carePage.empty")}</p>
            <Link href="/measure" className="mt-3 inline-block text-sm font-semibold text-[#2E5A88]">{t("carePage.goMeasure")} →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((a) => {
              const done = a.status === "done";
              const urgent = a.action_type === "emergency";
              return (
                <div key={a.id} className={`rounded-2xl border p-4 ${urgent && !done ? "border-l-4 border-[#D4691B] bg-orange-50/30" : "border-gray-200 bg-white"} ${done ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-800">{careLabel(t, a.action_type)}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{statusLabelOf(a.status)}</span>
                      {!done && (
                        <form action={completeCareAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" className="rounded-lg bg-[#1a8f84] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#137a6e]">{t("careStatus.done")}</button>
                        </form>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{t(`careDesc.${a.action_type}`)}</p>
                  {a.due_at && <p className="mt-1 text-xs text-gray-400">{t("carePage.dueAt", { date: fmtDate(locale, a.due_at) })}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 진료의뢰 */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{t("carePage.referralTitle")}</h2>
          {topAssessment && (
            <form action={createReferral}>
              <input type="hidden" name="assessment_id" value={topAssessment.id} />
              <button type="submit" className="rounded-lg border border-[#2E5A88] px-3 py-1.5 text-xs font-semibold text-[#2E5A88] transition hover:bg-[#eef5fb]">{t("carePage.createSummary")}</button>
            </form>
          )}
        </div>
        {referrals.length === 0 ? (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">{t("carePage.referralEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 text-sm">
                <span className="text-gray-700">{t("carePage.referralTitle")} · {fmtDate(locale, r.created_at)}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{r.status === "created" ? t("carePage.created") : r.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 환류(재측정 결과) */}
      {topAssessment && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700">{t("carePage.feedbackTitle")}</h2>
          <p className="mt-1 text-xs text-gray-500">{t("carePage.feedbackNote")}</p>
          <form action={registerFeedback} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="assessment_id" value={topAssessment.id} />
            {FEEDBACK_OUTCOMES.map(([v, c]) => (
              <button key={v} type="submit" name="outcome" value={v}
                className="rounded-full border px-4 py-1.5 text-sm font-medium transition hover:bg-gray-50" style={{ borderColor: c, color: c }}>
                {t(`carePage.outcome.${v}`)}
              </button>
            ))}
          </form>
        </section>
      )}

      <p className="mt-5 text-center text-xs text-gray-400">{t("carePage.pdfNote")}</p>
    </main>
  );
}
