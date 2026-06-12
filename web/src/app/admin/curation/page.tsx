// 큐레이션 규칙 뷰어 — 어떤 조건에서 어떤 콘텐츠가 노출되는지. (편집기·시뮬레이터는 추후)
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { DISEASE_KO } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
function condText(cond: any): string {
  const parts: string[] = [];
  if (cond.first_time) parts.push("첫 측정");
  if (cond.disease) parts.push(`질환 ${DISEASE_KO[cond.disease] ?? cond.disease}`);
  if (cond.risk_grade) parts.push(`등급 ${(Array.isArray(cond.risk_grade) ? cond.risk_grade : [cond.risk_grade]).join("/")}`);
  if (cond.analyte_flags) parts.push(Object.entries(cond.analyte_flags).map(([k, v]) => `${k} ${v}`).join(", "));
  if (cond.risk_trend) parts.push(`추세 ${cond.risk_trend}`);
  if (cond.streak_days) parts.push(`연속측정 ${cond.streak_days}`);
  return parts.join(" · ") || "(전체)";
}

export default async function CurationPage() {
  await requireRole(["admin"]);
  const rules = await prisma.content_curation_rule.findMany({ include: { content: true }, orderBy: { priority: "asc" } });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/admin" className="text-sm text-gray-400">← 관리자</Link>
      <h1 className="mt-1 text-xl font-bold text-ink">큐레이션 규칙</h1>
      <p className="mb-5 text-xs text-gray-400">우선순위(낮을수록 먼저)로 조건에 맞는 게시 콘텐츠를 개인화 피드에 노출합니다.</p>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr><th className="px-4 py-2">우선</th><th className="px-4 py-2">조건</th><th className="px-4 py-2">노출 콘텐츠</th><th className="px-4 py-2">상태</th></tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="num px-4 py-2.5 text-gray-500">{r.priority}</td>
                <td className="px-4 py-2.5 text-gray-700">{condText(r.condition)}</td>
                <td className="px-4 py-2.5">
                  <span className="font-medium text-gray-800">{r.content.title}</span>
                  <span className="num ml-1 text-[11px] text-gray-400">{r.content.id}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white`} style={{ background: r.content.status === "published" ? "#2E9E5B" : "#9ca3af" }}>
                    {r.content.status === "published" ? "게시중" : "미게시"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-400">※ 규칙 GUI 편집기·충돌 시뮬레이터는 추후 확장. 미게시 콘텐츠를 가리키는 규칙은 매칭돼도 노출되지 않습니다.</p>
    </main>
  );
}
