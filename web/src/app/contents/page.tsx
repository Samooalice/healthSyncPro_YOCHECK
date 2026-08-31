// 콘텐츠 피드 (9.1) — 상단 탭으로 종류 분리 + 개인화 큐레이션.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { curateFeed, type CurationContext } from "@/lib/content/curate";
import { contentTranslations } from "@/lib/content/i18n";
import type { Locale } from "@/i18n/config";
import type { Analyte } from "@/config/algoParams";

export const dynamic = "force-dynamic";

const ANALYTES: Analyte[] = [
  "glucose", "protein", "ph", "specific_gravity", "ketone",
  "blood", "leukocyte", "nitrite", "urobilinogen", "bilirubin", "vitamin_c",
];

type Row = { id: string; title: string; body: string | null; category: string; format: string | null };

// 탭 라벨은 contentTab.* 카탈로그
const TABS: { key: string; match: (c: Row) => boolean }[] = [
  { key: "all", match: () => true },
  { key: "result_explain", match: (c) => c.category === "result_explain" },
  { key: "disease_edu", match: (c) => c.category === "disease_edu" && c.format !== "quiz" },
  { key: "quiz", match: (c) => c.format === "quiz" },
  { key: "lifestyle", match: (c) => c.category === "lifestyle" },
  { key: "risk_action", match: (c) => c.category === "risk_action" },
  { key: "motivation", match: (c) => c.category === "motivation" },
];

// 형식 배지 색. 라벨은 contentFormat.* 카탈로그
const BADGE_COLOR: Record<string, string> = {
  quiz: "#a67c00",
  checklist: "#127a6e",
  article: "#2E5A88",
};

export default async function ContentsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const sp = await searchParams;
  const cat = TABS.some((t) => t.key === sp.cat) ? sp.cat! : "all";
  const tab = TABS.find((t) => t.key === cat)!;

  const user = await getCurrentUser();
  let curated: Awaited<ReturnType<typeof curateFeed>> = [];
  if (user) {
    const meas = await prisma.measurement.findFirst({ where: { user_id: user.id }, orderBy: { measured_at: "desc" } });
    const latest = meas ? await prisma.risk_assessment.findFirst({ where: { measurement_id: meas.id }, orderBy: { risk_score: "desc" } }) : null;
    if (latest && meas) {
      const flags: Record<string, number> = {};
      for (const a of ANALYTES) { const v = (meas as Record<string, unknown>)[a]; if (v != null) flags[a] = Number(v); }
      curated = await curateFeed({ disease: latest.disease, risk_grade: latest.risk_grade, analyte_flags: flags } as CurationContext, 10, locale);
    }
  }

  const all = await prisma.content.findMany({ where: { status: "published", audience: "user" }, orderBy: { category: "asc" } });
  const rows = (all as Row[]).filter(tab.match);
  // 목록 카드의 제목·본문도 현재 언어로 (번역이 없는 항목은 ko 그대로)
  const tr = await contentTranslations(locale, rows.map((c) => c.id));
  const list = rows.map((c) => {
    const x = tr.get(c.id);
    return x ? { ...c, title: x.title || c.title, body: x.body ?? c.body } : c;
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 text-xl font-bold text-ink">{t("nav.contents")}</h1>

      {/* 탭 메뉴 */}
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-px">
        {TABS.map((tab) => {
          const active = tab.key === cat;
          return (
            <Link key={tab.key} href={tab.key === "all" ? "/contents" : `/contents?cat=${tab.key}`}
              className="rounded-t-lg px-3.5 py-2 text-sm transition"
              style={{
                color: active ? "#2E5A88" : "#6b7280", fontWeight: active ? 700 : 500,
                borderBottom: active ? "2px solid #2E5A88" : "2px solid transparent",
              }}>
              {t(`contentTab.${tab.key}`)}
            </Link>
          );
        })}
      </nav>

      {/* 개인화 큐레이션 (전체 탭에서만) */}
      {cat === "all" && curated.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">{t("contentsPage.forYou")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {curated.map((c) => (
              <Link key={c.content_id} href={`/contents/${c.content_id}`} className="block rounded-2xl border-l-4 border-[#2E5A88] bg-blue-50/30 p-4 transition hover:bg-blue-50/60">
                <div className="text-sm font-semibold text-gray-800">{c.title}</div>
                {c.body && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-600">{c.body}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 탭 콘텐츠 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((c) => {
          const badge = c.format && c.format in BADGE_COLOR ? c.format : null;
          return (
            <Link key={c.id} href={`/contents/${c.id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-[#2E5A88]/30 hover:shadow-sm">
              {badge && <span className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: BADGE_COLOR[badge] + "22", color: BADGE_COLOR[badge] }}>{t(`contentFormat.${badge}`)}</span>}
              <div className="text-sm font-semibold text-gray-800">{c.title}</div>
              {c.body && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-gray-600">{c.body}</p>}
            </Link>
          );
        })}
      </div>
      {list.length === 0 && <p className="py-8 text-center text-sm text-gray-400">{t("contentsPage.empty")}</p>}

      <p className="mt-8 text-center text-xs text-gray-400">
        {t("contentsPage.note")}
      </p>
    </main>
  );
}
