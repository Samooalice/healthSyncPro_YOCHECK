// GET /api/v1/assessments/{id} — 위험평가 상세 + 설명(P4) + 케어액션 + 개인화 콘텐츠.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { curateFeed, type CurationContext } from "@/lib/content/curate";
import type { Analyte } from "@/config/algoParams";
import { getTranslations } from "next-intl/server";

const ANALYTES: Analyte[] = [
  "glucose", "protein", "ph", "specific_gravity", "ketone",
  "blood", "leukocyte", "nitrite", "urobilinogen", "bilirubin", "vitamin_c",
];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("apiError");
  const { id } = await ctx.params;

  const assessment = await prisma.risk_assessment.findUnique({ where: { id } });
  if (!assessment) {
    return NextResponse.json(
      { type: "https://errors.sdcwellcare/not_found", title: "not_found", status: 404, detail: t("assessmentNotFound") },
      { status: 404, headers: { "content-type": "application/problem+json" } },
    );
  }

  const [explanation, measurement, careActions, measCount] = await Promise.all([
    prisma.explanation.findUnique({ where: { assessment_id: id } }),
    prisma.measurement.findUnique({ where: { id: assessment.measurement_id } }),
    prisma.care_action.findMany({ where: { assessment_id: id }, orderBy: { created_at: "asc" } }),
    prisma.measurement.count({ where: { user_id: assessment.user_id } }),
  ]);

  // 큐레이션 컨텍스트
  const analyteFlags: Record<string, number> = {};
  if (measurement) {
    for (const a of ANALYTES) {
      const v = (measurement as Record<string, unknown>)[a];
      if (v != null) analyteFlags[a] = Number(v);
    }
  }
  const curationCtx: CurationContext = {
    disease: assessment.disease,
    risk_grade: assessment.risk_grade,
    analyte_flags: analyteFlags,
    first_time: measCount <= 1,
  };
  const contents = await curateFeed(curationCtx);

  return NextResponse.json({
    id: assessment.id,
    measurement_id: assessment.measurement_id,
    disease: assessment.disease,
    risk_score: Number(assessment.risk_score),
    risk_grade: assessment.risk_grade,
    standard_grade: assessment.standard_grade,
    is_samd_output: assessment.is_samd_output,
    model_version: assessment.model_version,
    assessed_at: assessment.assessed_at,
    measured_values: analyteFlags,
    explanation: explanation
      ? {
          shap_top: explanation.shap_values,
          text_user: explanation.text_user,
          text_clinician: explanation.text_clinician,
          counterfactual: explanation.counterfactual,
        }
      : null,
    care_actions: careActions.map((c) => ({
      id: c.id,
      action_type: c.action_type,
      status: c.status,
      due_at: c.due_at,
    })),
    contents,
  });
}
