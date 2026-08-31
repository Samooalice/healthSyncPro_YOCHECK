// CMS — 콘텐츠 관리 + 검수 워크플로(상태기계). 관리자 전용.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { contentTransition } from "./actions";

export const dynamic = "force-dynamic";

/** 상태 → 배지 색. 라벨은 contentStatus.* 카탈로그. */
const STATUS_COLOR: Record<string, string> = {
  draft: "#9ca3af",
  medical_review: "#C79100",
  ra_review: "#2E5A88",
  ready: "#1a8f84",
  published: "#2E9E5B",
  unpublished: "#9ca3af",
};
const CATEGORIES = [
  "result_explain", "disease_edu", "lifestyle", "risk_action",
  "motivation", "safety", "clinician", "caregiver",
];
// 상태별 가능한 전이 [action, style] — 버튼 문구는 contentAction.* 카탈로그
const NEXT: Record<string, [string, "primary" | "danger" | "ghost"][]> = {
  draft: [["submit", "primary"]],
  medical_review: [["med_approve", "primary"], ["med_reject", "danger"]],
  ra_review: [["ra_approve", "primary"], ["ra_reject", "danger"]],
  ready: [["publish", "primary"]],
  published: [["unpublish", "ghost"]],
  unpublished: [["republish", "primary"]],
};
/** 전이 버튼의 action 값 — republish 는 표기만 다르고 서버 액션은 publish 다. */
const ACTION_VALUE: Record<string, string> = { republish: "publish" };
const ORDER = ["medical_review", "ra_review", "ready", "draft", "published", "unpublished"];

export default async function CmsContentsPage() {
  await requireRole(["admin"]);
  const t = await getTranslations();
  const contents = await prisma.content.findMany({ orderBy: { id: "asc" } });
  contents.sort((a, b) => (ORDER.indexOf(a.status ?? "draft") - ORDER.indexOf(b.status ?? "draft")));
  const pending = contents.filter((c) => c.status === "medical_review" || c.status === "ra_review" || c.status === "ready").length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-400">← {t("nav.admin")}</Link>
          <h1 className="text-xl font-bold text-ink">{t("cms.title")}</h1>
          <p className="text-xs text-gray-400">{t("cms.subtitle", { n: pending })}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">{t("cms.colContent")}</th><th className="px-4 py-2">{t("cms.colCategory")}</th>
              <th className="px-4 py-2">{t("curation.colStatus")}</th><th className="px-4 py-2">{t("contentStatus.medical_review")}</th>
              <th className="px-4 py-2 text-right">{t("cms.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {contents.map((c) => {
              const status = c.status && c.status in STATUS_COLOR ? c.status : "draft";
              const actions = NEXT[status] ?? [];
              const review = c.medical_review === "approved" ? "approved" : c.medical_review === "rejected" ? "rejected" : "waiting";
              return (
                <tr key={c.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{c.title}</div>
                    <div className="num text-[11px] text-gray-400">{c.id} · {c.audience}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{CATEGORIES.includes(c.category) ? t(`contentCategory.${c.category}`) : c.category}</td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: STATUS_COLOR[status] }}>{t(`contentStatus.${status}`)}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t(`reviewState.${review}`)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {actions.map(([action, style]) => (
                        <form key={action} action={contentTransition}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="action" value={ACTION_VALUE[action] ?? action} />
                          <button type="submit" className="rounded-lg px-2.5 py-1 text-xs font-semibold transition"
                            style={style === "primary" ? { background: "#2E5A88", color: "#fff" }
                              : style === "danger" ? { background: "#FBE3E3", color: "#C8453B" }
                              : { border: "1px solid #e5e7eb", color: "#6b7280" }}>
                            {t(`contentAction.${action}`)}
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
      <p className="mt-4 text-xs text-gray-400">{t("cms.note")}</p>
    </main>
  );
}
