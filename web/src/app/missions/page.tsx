// 미션·뱃지 (7.7) — 포인트·스트릭·오늘의 미션·뱃지·위험개선 시각화. 동기부여 톤.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getState, todayMissions } from "@/lib/gamification/engine";
import { BADGES, POINTS, goalKey, missionLabelKey, missionTipKey } from "@/lib/gamification/catalog";
import { diseaseLabel } from "@/lib/ui/labels";
import TrendChart, { type TrendPoint } from "@/components/TrendChart";
import { completeMissionAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const t = await getTranslations();

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
  const gk = goalKey(disease);

  const summary = [
    { label: t("missions.points"), value: state.points, sub: t("missions.pointsSub"), color: "#2E5A88" },
    { label: t("missions.streak"), value: t("missions.days", { n: state.streak_days }), sub: `${t("missions.streakSub")} 🔥`, color: "#D4691B" },
    { label: t("missions.badgesEarned"), value: `${earned.size}/${BADGES.length}`, sub: t("missions.badgesSub"), color: "#127a6e" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-ink">{t("missions.title")}</h1>
        <p className="text-sm text-body">{t("missions.subtitle")}</p>
      </header>

      {/* 포인트 · 스트릭 · 뱃지 요약 */}
      <section className="mb-6 grid grid-cols-3 gap-3">
        {summary.map((k) => (
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
            <h2 className="font-semibold text-gray-800">{t("missions.today")}</h2>
            <span className="text-xs text-gray-400">
              {t("missions.doneCount", { done: doneToday, total: missions.length })} · {t("missions.perMission", { p: POINTS.mission })}
            </span>
          </div>
          {gk && (
            <div className="mb-3 rounded-xl bg-[#eef5fb] px-3 py-2 text-sm text-[#2E5A88]">
              <b>{t("missions.goal")}</b> · {t(gk)} {disease && <span className="text-xs text-gray-400">({diseaseLabel(t, disease)})</span>}
            </div>
          )}
          <ul className="space-y-2">
            {missions.map(({ def, done }) => (
              <li key={def.key} className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: done ? "#cde7e0" : "#eef0f2", background: done ? "#f1faf7" : "#fff" }}>
                <form action={completeMissionAction} className="pt-0.5">
                  <input type="hidden" name="key" value={def.key} />
                  <button disabled={done} aria-label={done ? t("missions.completed") : t("missions.markDone")}
                    className="grid h-6 w-6 place-items-center rounded-full border text-sm transition disabled:cursor-default"
                    style={done ? { background: "#127a6e", borderColor: "#127a6e", color: "#fff" } : { borderColor: "#cbd5e1", color: "transparent" }}>✓</button>
                </form>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${done ? "text-gray-400 line-through" : "text-gray-800"}`}>{t(missionLabelKey(def))}</div>
                  <div className="text-xs text-gray-500">{t(missionTipKey(def))}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-gray-400">{t("missions.resetNote")}</p>
        </section>

        {/* 위험 개선 시각화 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-gray-800">{t("missions.trendTitle")}</h2>
          {riskPoints.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">{t("missions.trendEmpty")}</p>
          ) : (
            <>
              <TrendChart t={t} data={riskPoints} analyteLabel={t("missions.riskScore")} color={improved ? "#127a6e" : "#2E5A88"} valueFormat={(v) => v.toFixed(2)} />
              <p className="mt-2 text-sm text-gray-600">
                {riskPoints.length < 2 ? t("missions.trendNeedMore") :
                  improved ? <span className="text-teal-700">{t("missions.trendImproved")} 📉</span> :
                  t("missions.trendFlat")}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">{t("missions.trendNote")}</p>
            </>
          )}
        </section>
      </div>

      {/* 뱃지 갤러리 */}
      <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-800">{t("missions.badgeCollection")}</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {BADGES.map((b) => {
            const has = earned.has(b.key);
            return (
              <div key={b.key} className="rounded-xl border p-3 text-center" style={{ borderColor: has ? "#e5d4b8" : "#eef0f2", background: has ? "#fffdf6" : "#fafafa", opacity: has ? 1 : 0.55 }}>
                <div className="text-2xl" style={{ filter: has ? "none" : "grayscale(1)" }}>{b.icon}</div>
                <div className="mt-1 text-xs font-semibold text-gray-700">{t(`badge.${b.key}.label`)}</div>
                <div className="text-[10px] leading-tight text-gray-400">{t(`badge.${b.key}.desc`)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="mt-6 rounded-lg bg-gray-100 p-3 text-xs leading-relaxed text-gray-500">
        {t("missions.disclaimer")}
      </p>
    </main>
  );
}
