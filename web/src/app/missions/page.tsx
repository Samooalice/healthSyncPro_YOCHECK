// 미션·뱃지 (7.7) — 포인트·스트릭·오늘의 미션·뱃지·위험개선 시각화. 동기부여 톤.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getState, todayMissions } from "@/lib/gamification/engine";
import { BADGES, GOAL_SUGGESTION, POINTS } from "@/lib/gamification/catalog";
import { DISEASE_KO } from "@/lib/ui/labels";
import TrendChart, { type TrendPoint } from "@/components/TrendChart";
import { completeMissionAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const meas = await prisma.measurement.findFirst({ where: { user_id: me.id }, orderBy: { measured_at: "desc" } });
  const top = meas ? await prisma.risk_assessment.findFirst({ where: { measurement_id: meas.id }, orderBy: { risk_score: "desc" } }) : null;
  const disease = top?.disease ?? null;

  const [state, missions, history] = await Promise.all([
    getState(me.id),
    todayMissions(me.id, disease),
    prisma.measurement.findMany({ where: { user_id: me.id }, orderBy: { measured_at: "asc" }, take: 12, select: { id: true, measured_at: true } }),
  ]);

  // 위험 개선 시각화 — 측정별 대표(최고) 위험점수 추세
  const riskPoints: TrendPoint[] = [];
  for (const m of history) {
    const a = await prisma.risk_assessment.findFirst({ where: { measurement_id: m.id }, orderBy: { risk_score: "desc" }, select: { risk_score: true } });
    if (a) riskPoints.push({ date: m.measured_at.toISOString(), value: Number(a.risk_score) });
  }
  const improved = riskPoints.length >= 2 && riskPoints[riskPoints.length - 1].value < riskPoints[0].value;

  const doneToday = missions.filter((m) => m.done).length;
  const earned = new Set(state.badges);
  const goal = disease ? GOAL_SUGGESTION[disease] : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-ink">미션 · 뱃지</h1>
        <p className="text-sm text-body">꾸준한 측정과 작은 생활 실천이 건강 습관이 됩니다.</p>
      </header>

      {/* 포인트 · 스트릭 · 뱃지 요약 */}
      <section className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "포인트", value: state.points, sub: "활동 적립", color: "#2E5A88" },
          { label: "연속 측정", value: `${state.streak_days}일`, sub: "스트릭 🔥", color: "#D4691B" },
          { label: "획득 뱃지", value: `${earned.size}/${BADGES.length}`, sub: "수집", color: "#127a6e" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
            <div className="num text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-sm font-medium text-gray-700">{k.label}</div>
            <div className="text-[11px] text-gray-400">{k.sub}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 오늘의 미션 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">오늘의 미션</h2>
            <span className="text-xs text-gray-400">{doneToday}/{missions.length} 완료 · 미션당 +{POINTS.mission}P</span>
          </div>
          {goal && (
            <div className="mb-3 rounded-xl bg-[#eef5fb] px-3 py-2 text-sm text-[#2E5A88]">
              <b>건강 목표</b> · {goal} {disease && <span className="text-xs text-gray-400">({DISEASE_KO[disease]})</span>}
            </div>
          )}
          <ul className="space-y-2">
            {missions.map(({ def, done }) => (
              <li key={def.key} className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: done ? "#cde7e0" : "#eef0f2", background: done ? "#f1faf7" : "#fff" }}>
                <form action={completeMissionAction} className="pt-0.5">
                  <input type="hidden" name="key" value={def.key} />
                  <button disabled={done} aria-label={done ? "완료됨" : "완료하기"}
                    className="grid h-6 w-6 place-items-center rounded-full border text-sm transition disabled:cursor-default"
                    style={done ? { background: "#127a6e", borderColor: "#127a6e", color: "#fff" } : { borderColor: "#cbd5e1", color: "transparent" }}>✓</button>
                </form>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${done ? "text-gray-400 line-through" : "text-gray-800"}`}>{def.label}</div>
                  <div className="text-xs text-gray-500">{def.tip}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-gray-400">※ 미션은 매일 0시 초기화됩니다. 생활관리 콘텐츠와 연동돼요.</p>
        </section>

        {/* 위험 개선 시각화 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-gray-800">위험 개선 추세</h2>
          {riskPoints.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">측정을 시작하면 위험도 변화가 여기에 그려져요.</p>
          ) : (
            <>
              <TrendChart data={riskPoints} analyteLabel="대표 위험점수" color={improved ? "#127a6e" : "#2E5A88"} valueFormat={(v) => v.toFixed(2)} />
              <p className="mt-2 text-sm text-gray-600">
                {riskPoints.length < 2 ? "측정이 쌓이면 변화를 비교해 드려요." :
                  improved ? <span className="text-teal-700">최근 위험점수가 처음보다 낮아졌어요. 좋은 흐름이에요! 📉</span> :
                  "위험점수가 아직 안정적이지 않아요. 미션과 재측정으로 관리해 보세요."}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">※ 위험점수는 0에 가까울수록 낮음. 소변검사와 건강검진을 함께 본 값이에요.</p>
            </>
          )}
        </section>
      </div>

      {/* 뱃지 갤러리 */}
      <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-800">뱃지 컬렉션</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {BADGES.map((b) => {
            const has = earned.has(b.key);
            return (
              <div key={b.key} className="rounded-xl border p-3 text-center" style={{ borderColor: has ? "#e5d4b8" : "#eef0f2", background: has ? "#fffdf6" : "#fafafa", opacity: has ? 1 : 0.55 }}>
                <div className="text-2xl" style={{ filter: has ? "none" : "grayscale(1)" }}>{b.icon}</div>
                <div className="mt-1 text-xs font-semibold text-gray-700">{b.label}</div>
                <div className="text-[10px] leading-tight text-gray-400">{b.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="mt-6 rounded-lg bg-gray-100 p-3 text-xs leading-relaxed text-gray-500">
        포인트·뱃지는 건강 습관 형성을 돕기 위한 활동 보상이며, 의료적 효과를 보장하지 않습니다.
        건강생활실천지원금 등 외부 보상 연계는 정책 검토 단계입니다. 측정·생활관리는 자율적으로 진행하세요.
      </p>
    </main>
  );
}
