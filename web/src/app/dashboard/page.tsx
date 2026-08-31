// 사용자 대시보드 (로그인 후 홈) — 계획서 9.1 홈 / F.3 피드. 데스크톱 레이아웃.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { curateFeed, type CurationContext } from "@/lib/content/curate";
import { getState, todayMissions } from "@/lib/gamification/engine";
import { missionLabelKey } from "@/lib/gamification/catalog";
import { GRADE_TOKEN, gradeLabel, diseaseLabel } from "@/lib/ui/labels";
import { localizeExplanation } from "@/lib/ui/explanation";
import { fmtDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import type { Analyte } from "@/config/algoParams";

export const dynamic = "force-dynamic";

const ANALYTES: Analyte[] = [
  "glucose", "protein", "ph", "specific_gravity", "ketone",
  "blood", "leukocyte", "nitrite", "urobilinogen", "bilirubin", "vitamin_c",
];

async function getHomeData(userId: string, locale: Locale) {
  const measCount = await prisma.measurement.count({ where: { user_id: userId } });
  // 최신 측정 → 그 측정의 질환별 평가 중 위험점수 최고를 대표로
  const measurement = await prisma.measurement.findFirst({ where: { user_id: userId }, orderBy: { measured_at: "desc" } });
  if (!measurement) return { latest: null, explanation: null, contents: [], measCount, diseases: [] };
  const diseases = await prisma.risk_assessment.findMany({ where: { measurement_id: measurement.id }, orderBy: { risk_score: "desc" } });
  const latest = diseases[0] ?? null;
  if (!latest) return { latest: null, explanation: null, contents: [], measCount, diseases: [] };

  const explanation = await prisma.explanation.findUnique({ where: { assessment_id: latest.id } });
  const flags: Record<string, number> = {};
  for (const a of ANALYTES) {
    const v = (measurement as Record<string, unknown>)[a];
    if (v != null) flags[a] = Number(v);
  }
  const ctx: CurationContext = { disease: latest.disease, risk_grade: latest.risk_grade, analyte_flags: flags, first_time: measCount <= 1 };
  const contents = await curateFeed(ctx, 10, locale);
  return { latest, explanation, contents, measCount, diseases };
}

export default async function Dashboard() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const data = await getHomeData(me.id, locale);
  const latest = data?.latest ?? null;
  const [gam, missions] = await Promise.all([getState(me.id), todayMissions(me.id, latest?.disease ?? null)]);
  const missionsDone = missions.filter((m) => m.done).length;
  const explained = localizeExplanation(t, data?.explanation);
  const g = latest ? GRADE_TOKEN[latest.risk_grade] ?? GRADE_TOKEN.low : null;
  const urgent = latest && (latest.risk_grade === "high" || latest.risk_grade === "very_high");

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {me.display_name
              ? t("dashboard.titleNamed", { name: me.display_name })
              : t("dashboard.titleMine")}
          </h1>
          <p className="text-sm text-body">{t("dashboard.subtitle")}</p>
        </div>
        <Link href="/measure" className="rounded-lg bg-[#2E5A88] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#24486e]">
          {t("dashboard.newMeasurement")}
        </Link>
      </div>

      {!latest && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-600">{t("dashboard.emptyTitle")}</p>
          <Link href="/measure" className="mt-4 inline-block rounded-lg bg-[#2E5A88] px-5 py-2.5 font-semibold text-white">{t("dashboard.startFirst")}</Link>
        </div>
      )}

      {latest && g && (
        <>
          {urgent && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border-l-4 p-4" style={{ borderColor: g.color, background: g.bg }}>
              <span className="text-sm font-bold" style={{ color: g.color }}>⚠ {gradeLabel(t, latest.risk_grade)}</span>
              <span className="text-sm text-gray-700">{t("dashboard.urgentNote")}</span>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            {/* 최근 결과 (2칸) */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">{t("dashboard.recentResult")}</h2>
                <span className="text-xs text-gray-400">{fmtDateTime(locale, latest.assessed_at)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: g.color }}>{gradeLabel(t, latest.risk_grade)}</span>
                <span className="text-sm text-gray-600">
                  {t("common.riskOf", {
                    disease: diseaseLabel(t, latest.disease),
                    score: Number(latest.risk_score).toFixed(2),
                  })}
                  {latest.standard_grade && ` · ${t("common.standardGrade", { grade: latest.standard_grade })}`}
                </span>
              </div>
              {explained && <p className="mt-3 text-sm leading-relaxed text-gray-700">{explained.text_user}</p>}

              {/* 질환별 위험 (모든 질환) */}
              {data && data.diseases.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {data.diseases.map((d) => {
                    const dg = GRADE_TOKEN[d.risk_grade] ?? GRADE_TOKEN.low;
                    return (
                      <Link key={d.id} href={`/result/${d.id}`}
                        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition hover:bg-gray-50"
                        style={{ borderColor: d.risk_grade === "low" ? "#e5e7eb" : dg.color }}>
                        <span className="text-gray-600">{diseaseLabel(t, d.disease)}</span>
                        <span className="font-semibold" style={{ color: dg.color }}>{gradeLabel(t, d.risk_grade)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              <Link href={`/result/${latest.id}`} className="mt-4 inline-block text-sm font-semibold text-[#2E5A88]">{t("dashboard.viewDetail")}</Link>
            </section>

            {/* 사이드: 미션 + 스트릭 */}
            <div className="space-y-5">
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">{t("dashboard.todayMissions")}</h2>
                  <span className="text-xs text-gray-400">{missionsDone}/{missions.length}</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {missions.map(({ def, done }) => (
                    <li key={def.key} className={done ? "text-gray-400 line-through" : "text-gray-700"}>
                      {done ? "●" : "○"} {t(missionLabelKey(def))}
                    </li>
                  ))}
                </ul>
                <Link href="/missions" className="mt-3 inline-block text-sm font-semibold text-[#2E5A88]">{t("dashboard.viewAllMissions")}</Link>
              </section>
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 font-semibold text-gray-800">{t("dashboard.myActivity")}</h2>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><div className="num text-xl font-bold text-[#2E5A88]">{gam.points}</div><div className="text-[11px] text-gray-400">{t("dashboard.points")}</div></div>
                  <div><div className="num text-xl font-bold text-[#D4691B]">{gam.streak_days}</div><div className="text-[11px] text-gray-400">{t("dashboard.streakDays")} 🔥</div></div>
                  <div><div className="num text-xl font-bold text-[#127a6e]">{gam.badges.length}</div><div className="text-[11px] text-gray-400">{t("dashboard.badges")}</div></div>
                </div>
                <div className="mt-2 text-center text-xs text-gray-400">{t("dashboard.measureCount", { n: data?.measCount ?? 0 })}</div>
              </section>
            </div>
          </div>

          {/* 맞춤 콘텐츠 */}
          {data && data.contents.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 font-semibold text-gray-800">{t("common.recommended")}</h2>
              <div className={`grid gap-4 ${data.contents.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {data.contents.map((c) => (
                  <Link key={c.content_id} href={`/contents/${c.content_id}`} className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="text-sm font-semibold text-gray-800">{c.title}</div>
                    {c.body && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-gray-600">{c.body}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
