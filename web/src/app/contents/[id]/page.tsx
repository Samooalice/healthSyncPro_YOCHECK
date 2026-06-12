// 콘텐츠 상세 — 형식별 렌더링(아티클 섹션 · 퀴즈 인터랙션 · 체크리스트 미션 · 일반 본문).
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { logEngagement } from "@/lib/content/engage";
import QuizView from "@/components/content/QuizView";
import ChecklistView from "@/components/content/ChecklistView";

export const dynamic = "force-dynamic";

const CATEGORY_KO: Record<string, string> = {
  result_explain: "결과 해설", disease_edu: "질환 정보", lifestyle: "생활관리",
  risk_action: "행동지침", motivation: "동기부여", safety: "안전·고지", caregiver: "보호자",
};
const FORMAT_KO: Record<string, string> = {
  card: "카드", article: "아티클", quiz: "퀴즈", checklist: "체크리스트", step_guide: "단계 가이드",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ContentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.content.findUnique({ where: { id } });
  if (!c || c.status !== "published") notFound();
  const p = (c.payload ?? null) as any;

  // 콘텐츠 조회 참여 기록(로그인 사용자) — user_content_log
  const viewer = await getCurrentUser();
  if (viewer) await logEngagement(viewer.id, id, "view");

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-5">
        <Link href="/contents" className="text-sm text-gray-400">← 콘텐츠</Link>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-[#eef5fb] px-2.5 py-0.5 text-[11px] font-semibold text-[#2E5A88]">{CATEGORY_KO[c.category] ?? c.category}</span>
          {c.format && FORMAT_KO[c.format] && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] text-gray-500">{FORMAT_KO[c.format]}</span>}
        </div>
        <h1 className="mt-3 font-serif text-2xl font-semibold text-ink">{c.title}</h1>
      </header>

      {/* 형식별 본문 */}
      {p?.kind === "quiz" ? (
        <QuizView questions={p.questions ?? []} />
      ) : p?.kind === "checklist" ? (
        <ChecklistView intro={p.intro} missions={p.missions ?? []} />
      ) : p?.kind === "article" ? (
        <article className="space-y-5">
          {(p.sections ?? []).map((s: any, i: number) => (
            <section key={i}>
              <h2 className="mb-1 text-sm font-bold text-[#2E5A88]">{s.h}</h2>
              <p className="text-[15px] leading-relaxed text-gray-700">{s.t}</p>
            </section>
          ))}
          {p.source && <p className="border-t border-gray-100 pt-3 text-xs text-gray-400">출처: {p.source}</p>}
        </article>
      ) : (
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-gray-700">{c.body}</p>
      )}

      <p className="mt-8 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">
        본 콘텐츠는 의료검수·규제검수를 거쳐 게시된 건강관리 선별 정보예요. 의료 진단을 대신하지 않으며, 우려되면 의료진과 상담해 보시길 권해요.
      </p>
    </main>
  );
}
