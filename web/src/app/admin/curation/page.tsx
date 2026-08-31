// 큐레이션 규칙 뷰어 — 어떤 조건에서 어떤 콘텐츠가 노출되는지. (편집기·시뮬레이터는 추후)
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { diseaseLabel } from "@/lib/ui/labels";
import type { Translate } from "@/i18n/t";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
function condText(t: Translate, cond: any): string {
  const parts: string[] = [];
  if (cond.first_time) parts.push(t("curation.firstTime"));
  if (cond.disease) parts.push(t("curation.condDisease", { value: diseaseLabel(t, cond.disease) }));
  if (cond.risk_grade) parts.push(t("curation.condGrade", { value: (Array.isArray(cond.risk_grade) ? cond.risk_grade : [cond.risk_grade]).join("/") }));
  if (cond.analyte_flags) parts.push(Object.entries(cond.analyte_flags).map(([k, v]) => `${k} ${v}`).join(", "));
  if (cond.risk_trend) parts.push(t("curation.condTrend", { value: cond.risk_trend }));
  if (cond.streak_days) parts.push(t("curation.condStreak", { value: cond.streak_days }));
  return parts.join(" · ") || t("curation.condAny");
}

export default async function CurationPage() {
  await requireRole(["admin"]);
  const t = await getTranslations();
  const rules = await prisma.content_curation_rule.findMany({ include: { content: true }, orderBy: { priority: "asc" } });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/admin" className="text-sm text-gray-400">← {t("nav.admin")}</Link>
      <h1 className="mt-1 text-xl font-bold text-ink">{t("curation.title")}</h1>
      <p className="mb-5 text-xs text-gray-400">{t("curation.subtitle")}</p>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">{t("curation.colPriority")}</th>
              <th className="px-4 py-2">{t("curation.colCondition")}</th>
              <th className="px-4 py-2">{t("curation.colContent")}</th>
              <th className="px-4 py-2">{t("curation.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="num px-4 py-2.5 text-gray-500">{r.priority}</td>
                <td className="px-4 py-2.5 text-gray-700">{condText(t, r.condition)}</td>
                <td className="px-4 py-2.5">
                  <span className="font-medium text-gray-800">{r.content.title}</span>
                  <span className="num ml-1 text-[11px] text-gray-400">{r.content.id}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: r.content.status === "published" ? "#2E9E5B" : "#9ca3af" }}>
                    {r.content.status === "published" ? t("curation.live") : t("curation.notLive")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-400">{t("curation.note")}</p>
    </main>
  );
}
