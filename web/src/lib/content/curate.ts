// 콘텐츠 개인화 큐레이션 — care.content_curation_rule 규칙을 컨텍스트에 매칭.
// 참고: 세부개발데이터 7.3 / D.7 큐레이션 규칙 인스턴스
import { prisma } from "@/lib/db";

export interface CurationContext {
  disease?: string;
  risk_grade?: string;
  analyte_flags?: Record<string, number>; // 항목별 raw 값
  first_time?: boolean;
  risk_trend?: "improved" | "worsened" | "stable";
  streak_days?: number;
}

export interface CuratedItem {
  content_id: string;
  category: string;
  format: string | null;
  title: string;
  body: string | null;
  priority: number;
  rule_id: string;
}

function cmp(value: number, expr: string): boolean {
  const m = /^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/.exec(String(expr).trim());
  if (!m) return false;
  const op = m[1] || ">=";
  const target = Number(m[2]);
  switch (op) {
    case ">=": return value >= target;
    case "<=": return value <= target;
    case ">": return value > target;
    case "<": return value < target;
    case "=": return value === target;
    default: return false;
  }
}

function ruleMatches(cond: Record<string, unknown>, ctx: CurationContext): boolean {
  if (cond.disease != null && cond.disease !== ctx.disease) return false;

  if (cond.risk_grade != null) {
    const grades = Array.isArray(cond.risk_grade) ? cond.risk_grade : [cond.risk_grade];
    if (!ctx.risk_grade || !grades.includes(ctx.risk_grade)) return false;
  }

  if (cond.analyte_flags && typeof cond.analyte_flags === "object") {
    const flags = cond.analyte_flags as Record<string, string>;
    for (const [analyte, expr] of Object.entries(flags)) {
      const v = ctx.analyte_flags?.[analyte];
      if (v == null || !cmp(v, expr)) return false;
    }
  }

  if (typeof cond.first_time === "boolean" && cond.first_time !== !!ctx.first_time) return false;
  if (cond.risk_trend != null && cond.risk_trend !== ctx.risk_trend) return false;
  if (cond.streak_days != null && !cmp(ctx.streak_days ?? 0, String(cond.streak_days))) return false;

  return true;
}

/** 컨텍스트에 맞는 게시된 콘텐츠를 우선순위(낮을수록 우선)로 반환. */
export async function curateFeed(ctx: CurationContext, limit = 10): Promise<CuratedItem[]> {
  const rules = await prisma.content_curation_rule.findMany({
    where: { active: true },
    include: { content: true },
    orderBy: { priority: "asc" },
  });

  const seen = new Set<string>();
  const items: CuratedItem[] = [];
  for (const r of rules) {
    if (!ruleMatches(r.condition as Record<string, unknown>, ctx)) continue;
    if (r.content.status !== "published") continue;
    if (seen.has(r.content.id)) continue;
    seen.add(r.content.id);
    items.push({
      content_id: r.content.id,
      category: r.content.category,
      format: r.content.format,
      title: r.content.title,
      body: r.content.body,
      priority: r.priority ?? 100,
      rule_id: r.id,
    });
    if (items.length >= limit) break;
  }
  return items;
}
