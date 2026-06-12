// CMS — 콘텐츠 관리 + 검수 워크플로(상태기계). 관리자 전용.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { contentTransition } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "초안", color: "#9ca3af" },
  medical_review: { label: "의료검수", color: "#C79100" },
  ra_review: { label: "규제검수", color: "#2E5A88" },
  ready: { label: "게시대기", color: "#1a8f84" },
  published: { label: "게시중", color: "#2E9E5B" },
  unpublished: { label: "게시중단", color: "#9ca3af" },
};
const CATEGORY: Record<string, string> = {
  result_explain: "결과해설", disease_edu: "질환정보", lifestyle: "생활관리", risk_action: "행동지침",
  motivation: "동기부여", safety: "안전", clinician: "의료진", caregiver: "보호자",
};
// 상태별 가능한 전이 버튼 [action, label, style]
const NEXT: Record<string, [string, string, "primary" | "danger" | "ghost"][]> = {
  draft: [["submit", "검수 제출", "primary"]],
  medical_review: [["med_approve", "의료 승인", "primary"], ["med_reject", "반려", "danger"]],
  ra_review: [["ra_approve", "규제 승인", "primary"], ["ra_reject", "반려", "danger"]],
  ready: [["publish", "게시", "primary"]],
  published: [["unpublish", "게시중단", "ghost"]],
  unpublished: [["publish", "재게시", "primary"]],
};
const ORDER = ["medical_review", "ra_review", "ready", "draft", "published", "unpublished"];

export default async function CmsContentsPage() {
  await requireRole(["admin"]);
  const contents = await prisma.content.findMany({ orderBy: { id: "asc" } });
  contents.sort((a, b) => (ORDER.indexOf(a.status ?? "draft") - ORDER.indexOf(b.status ?? "draft")));
  const pending = contents.filter((c) => c.status === "medical_review" || c.status === "ra_review" || c.status === "ready").length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-400">← 관리자</Link>
          <h1 className="text-xl font-bold text-ink">콘텐츠 관리 (CMS)</h1>
          <p className="text-xs text-gray-400">검수 워크플로: 초안 → 의료검수 → 규제검수 → 게시대기 → 게시 · 검수 대기 {pending}건</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">콘텐츠</th><th className="px-4 py-2">분류</th>
              <th className="px-4 py-2">상태</th><th className="px-4 py-2">의료검수</th>
              <th className="px-4 py-2 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {contents.map((c) => {
              const st = STATUS[c.status ?? "draft"] ?? STATUS.draft;
              const actions = NEXT[c.status ?? "draft"] ?? [];
              return (
                <tr key={c.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{c.title}</div>
                    <div className="num text-[11px] text-gray-400">{c.id} · {c.audience}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{CATEGORY[c.category] ?? c.category}</td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: st.color }}>{st.label}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.medical_review === "approved" ? "승인" : c.medical_review === "rejected" ? "반려" : "대기"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {actions.map(([action, label, style]) => (
                        <form key={action} action={contentTransition}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="action" value={action} />
                          <button type="submit" className="rounded-lg px-2.5 py-1 text-xs font-semibold transition"
                            style={style === "primary" ? { background: "#2E5A88", color: "#fff" }
                              : style === "danger" ? { background: "#FBE3E3", color: "#C8453B" }
                              : { border: "1px solid #e5e7eb", color: "#6b7280" }}>
                            {label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-400">※ 의료검수를 통과하지 못한 콘텐츠는 게시되지 않으며, 개인화 피드에는 게시중(published) 콘텐츠만 노출됩니다.</p>
    </main>
  );
}
