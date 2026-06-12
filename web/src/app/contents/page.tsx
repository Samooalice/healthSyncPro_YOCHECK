// 콘텐츠 피드 (9.1) — 상단 탭으로 종류 분리 + 개인화 큐레이션.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { curateFeed, type CurationContext } from "@/lib/content/curate";
import type { Analyte } from "@/config/algoParams";

export const dynamic = "force-dynamic";

const ANALYTES: Analyte[] = [
  "glucose", "protein", "ph", "specific_gravity", "ketone",
  "blood", "leukocyte", "nitrite", "urobilinogen", "bilirubin", "vitamin_c",
];

type Row = { id: string; title: string; body: string | null; category: string; format: string | null };

const TABS: { key: string; label: string; match: (c: Row) => boolean }[] = [
  { key: "all", label: "전체", match: () => true },
  { key: "result_explain", label: "결과 해설", match: (c) => c.category === "result_explain" },
  { key: "disease_edu", label: "질환 정보", match: (c) => c.category === "disease_edu" && c.format !== "quiz" },
  { key: "quiz", label: "퀴즈", match: (c) => c.format === "quiz" },
  { key: "lifestyle", label: "생활관리", match: (c) => c.category === "lifestyle" },
  { key: "risk_action", label: "행동지침", match: (c) => c.category === "risk_action" },
  { key: "motivation", label: "동기부여", match: (c) => c.category === "motivation" },
];

const BADGE: Record<string, { label: string; color: string }> = {
  quiz: { label: "퀴즈", color: "#a67c00" },
  checklist: { label: "체크리스트", color: "#127a6e" },
  article: { label: "아티클", color: "#2E5A88" },
};

export default async function ContentsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
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
      curated = await curateFeed({ disease: latest.disease, risk_grade: latest.risk_grade, analyte_flags: flags } as CurationContext);
    }
  }

  const all = await prisma.content.findMany({ where: { status: "published", audience: "user" }, orderBy: { category: "asc" } });
  const list = (all as Row[]).filter(tab.match);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 text-xl font-bold text-ink">콘텐츠</h1>

      {/* 탭 메뉴 */}
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-px">
        {TABS.map((t) => {
          const active = t.key === cat;
          return (
            <Link key={t.key} href={t.key === "all" ? "/contents" : `/contents?cat=${t.key}`}
              className="rounded-t-lg px-3.5 py-2 text-sm transition"
              style={{
                color: active ? "#2E5A88" : "#6b7280", fontWeight: active ? 700 : 500,
                borderBottom: active ? "2px solid #2E5A88" : "2px solid transparent",
              }}>
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* 개인화 큐레이션 (전체 탭에서만) */}
      {cat === "all" && curated.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">내 결과 맞춤</h2>
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
          const b = c.format ? BADGE[c.format] : null;
          return (
            <Link key={c.id} href={`/contents/${c.id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-[#2E5A88]/30 hover:shadow-sm">
              {b && <span className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: b.color + "22", color: b.color }}>{b.label}</span>}
              <div className="text-sm font-semibold text-gray-800">{c.title}</div>
              {c.body && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-gray-600">{c.body}</p>}
            </Link>
          );
        })}
      </div>
      {list.length === 0 && <p className="py-8 text-center text-sm text-gray-400">이 분류에 게시된 콘텐츠가 없어요.</p>}

      <p className="mt-8 text-center text-xs text-gray-400">
        모든 콘텐츠는 의료검수·규제검수를 거쳐 게시됩니다. 본 정보는 건강관리를 돕는 선별 정보이며 의료 진단을 대신하지 않습니다.
      </p>
    </main>
  );
}
