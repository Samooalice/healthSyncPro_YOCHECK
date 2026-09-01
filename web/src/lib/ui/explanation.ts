// 저장된 설명 레코드 → 현재 언어 문장.
// care.explanation.counterfactual JSONB 안의 spec(언어 중립)이 있으면 그것으로 다시 그리고,
// spec 이 없는 구 레코드는 저장된 한국어 문장을 그대로 쓴다(빈 화면 방지).
import { renderExplanation, type ExplanationSpec } from "@/lib/analysis/explainV2";
import type { Translate } from "@/i18n/t";

export interface StoredExplanationRow {
  text_user: string;
  text_clinician: string;
  counterfactual: unknown;
}

export interface LocalizedExplanation {
  text_user: string;
  text_clinician: string;
  recommendations: string[];
  safety_notice: string;
  /** spec 없이 저장된 구 레코드라 현재 언어로 다시 그리지 못한 경우 true */
  legacy: boolean;
}

function specOf(counterfactual: unknown): ExplanationSpec | null {
  if (!counterfactual || typeof counterfactual !== "object") return null;
  const spec = (counterfactual as { spec?: unknown }).spec;
  if (!spec || typeof spec !== "object") return null;
  return (spec as ExplanationSpec).v === 1 ? (spec as ExplanationSpec) : null;
}

export function localizeExplanation(
  t: Translate,
  row: StoredExplanationRow | null | undefined,
): LocalizedExplanation | null {
  if (!row) return null;
  const spec = specOf(row.counterfactual);
  if (spec) {
    const e = renderExplanation(t, spec);
    return {
      text_user: e.text_user,
      text_clinician: e.text_clinician,
      recommendations: e.recommendations,
      safety_notice: e.safety_notice,
      legacy: false,
    };
  }
  const cf = (row.counterfactual ?? {}) as { recommendations?: string[] };
  return {
    text_user: row.text_user,
    text_clinician: row.text_clinician,
    recommendations: cf.recommendations ?? [],
    safety_notice: "",
    legacy: true,
  };
}
