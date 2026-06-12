// 케어 (9.1 / P5) — 케어 액션(완료처리)·진료의뢰 생성·재측정 결과 환류.
import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { CARE_KO } from "@/lib/ui/labels";
import { completeCareAction, createReferral, registerFeedback } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_KO: Record<string, string> = { assigned: "예정", in_progress: "진행중", done: "완료", expired: "만료" };
const ACTION_DESC: Record<string, string> = {
  lifestyle: "생활습관 미션으로 위험을 관리해요.",
  recheck: "추세 확인을 위해 재측정을 권해요.",
  referral: "진료에 도움이 되는 요약 리포트를 준비해요.",
  emergency: "의료진과 상담해 보시길 권하는 단계예요.",
};

export default async function CarePage() {
  const user = await requireUser();
  const [actions, referrals, latestMeas] = await Promise.all([
    prisma.care_action.findMany({ where: { user_id: user.id }, orderBy: { created_at: "desc" }, take: 50 }),
    prisma.referral.findMany({ where: { user_id: user.id }, orderBy: { created_at: "desc" }, take: 10 }),
    prisma.measurement.findFirst({ where: { user_id: user.id }, orderBy: { measured_at: "desc" } }),
  ]);
  const topAssessment = latestMeas
    ? await prisma.risk_assessment.findFirst({ where: { measurement_id: latestMeas.id }, orderBy: { risk_score: "desc" } })
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-5 text-xl font-bold text-ink">케어</h1>

      {/* 케어 액션 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">권장 행동</h2>
        {actions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            <p>아직 케어 액션이 없어요.</p>
            <Link href="/measure" className="mt-3 inline-block text-sm font-semibold text-[#2E5A88]">측정하러 가기 →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((a) => {
              const done = a.status === "done";
              const urgent = a.action_type === "emergency";
              return (
                <div key={a.id} className={`rounded-2xl border p-4 ${urgent && !done ? "border-l-4 border-[#D4691B] bg-orange-50/30" : "border-gray-200 bg-white"} ${done ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-800">{CARE_KO[a.action_type] ?? a.action_type}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{STATUS_KO[a.status ?? "assigned"] ?? a.status}</span>
                      {!done && (
                        <form action={completeCareAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" className="rounded-lg bg-[#1a8f84] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#137a6e]">완료</button>
                        </form>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{ACTION_DESC[a.action_type] ?? ""}</p>
                  {a.due_at && <p className="mt-1 text-xs text-gray-400">기한: {new Date(a.due_at).toLocaleDateString("ko-KR")}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 진료의뢰 */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">진료의뢰 요약</h2>
          {topAssessment && (
            <form action={createReferral}>
              <input type="hidden" name="assessment_id" value={topAssessment.id} />
              <button type="submit" className="rounded-lg border border-[#2E5A88] px-3 py-1.5 text-xs font-semibold text-[#2E5A88] transition hover:bg-[#eef5fb]">요약 만들기</button>
            </form>
          )}
        </div>
        {referrals.length === 0 ? (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">의료진 상담 시 참고할 요약 리포트를 만들 수 있어요.</p>
        ) : (
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 text-sm">
                <span className="text-gray-700">진료의뢰 요약 · {new Date(r.created_at).toLocaleDateString("ko-KR")}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{r.status === "created" ? "생성됨" : r.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 환류(재측정 결과) */}
      {topAssessment && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700">재측정 결과 알려주기</h2>
          <p className="mt-1 text-xs text-gray-500">다시 측정한 결과를 알려주시면 분석 정확도 개선(재학습)에 반영돼요.</p>
          <form action={registerFeedback} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="assessment_id" value={topAssessment.id} />
            {[["improved", "좋아졌어요", "#2E9E5B"], ["stable", "비슷해요", "#6b7280"], ["worsened", "나빠졌어요", "#D4691B"]].map(([v, label, c]) => (
              <button key={v} type="submit" name="outcome" value={v}
                className="rounded-full border px-4 py-1.5 text-sm font-medium transition hover:bg-gray-50" style={{ borderColor: c as string, color: c as string }}>
                {label}
              </button>
            ))}
          </form>
        </section>
      )}

      <p className="mt-5 text-center text-xs text-gray-400">※ 진료의뢰 리포트 PDF·EMR 연계는 외부 연동(Step 6+)에서 확장됩니다.</p>
    </main>
  );
}
