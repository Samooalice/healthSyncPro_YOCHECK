// 콘텐츠 상세 — 형식별 렌더링(아티클 섹션 · 퀴즈 인터랙션 · 체크리스트 미션 · 일반 본문).
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { logEngagement } from "@/lib/content/engage";
import { contentTranslation } from "@/lib/content/i18n";
import type { Locale } from "@/i18n/config";
import QuizView from "@/components/content/QuizView";
import ChecklistView from "@/components/content/ChecklistView";

export const dynamic = "force-dynamic";

// 표시 문구는 contentTab.* / contentFormat.* 카탈로그
const CATEGORY_KEYS = ["result_explain", "disease_edu", "lifestyle", "risk_action", "motivation", "safety", "caregiver"];
const FORMAT_KEYS = ["card", "article", "quiz", "checklist", "step_guide"];

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ContentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const c = await prisma.content.findUnique({ where: { id } });
  if (!c || c.status !== "published") notFound();
  // 번역이 있으면 제목·본문·구조화 payload 를 통째로 갈아끼운다(구조는 동일).
  const tr = await contentTranslation(locale, id);
  const title = tr?.title || c.title;
  const bodyText = tr?.body ?? c.body;
  const p = ((tr?.payload ?? c.payload) ?? null) as any;

  // 콘텐츠 조회 참여 기록(로그인 사용자) — user_content_log
  const viewer = await getCurrentUser();
  if (viewer) await logEngagement(viewer.id, id, "view");

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-5">
        <Link href="/contents" className="text-sm text-gray-400">← {t("nav.contents")}</Link>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-[#eef5fb] px-2.5 py-0.5 text-[11px] font-semibold text-[#2E5A88]">{CATEGORY_KEYS.includes(c.category) ? t(`contentTab.${c.category}`) : c.category}</span>
          {c.format && FORMAT_KEYS.includes(c.format) && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] text-gray-500">{t(`contentFormat.${c.format}`)}</span>}
        </div>
        <h1 className="mt-3 font-serif text-2xl font-semibold text-ink">{title}</h1>
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
          {p.source && <p className="border-t border-gray-100 pt-3 text-xs text-gray-400">{t("contentsPage.source", { source: p.source })}</p>}
        </article>
      ) : (
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-gray-700">{bodyText}</p>
      )}

      <p className="mt-8 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">
        {t("contentsPage.detailNote")}
      </p>
    </main>
  );
}
