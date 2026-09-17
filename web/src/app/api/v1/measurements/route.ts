// POST /api/v1/measurements — 측정 업로드 → 동기 분석 파이프라인 실행.
// 인증은 Step 2에서 추가. 현재는 데모 사용자 사용.
import { NextResponse } from "next/server";
import { z } from "zod";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { isStaff, canAccessPatient } from "@/lib/auth/careTeam";
import { getTranslations } from "next-intl/server";

const ValuesSchema = z.object({
  glucose: z.number().min(0).max(4).optional(),
  protein: z.number().min(0).max(4).optional(),
  ph: z.number().min(4.5).max(9).optional(),
  specific_gravity: z.number().min(1.0).max(1.05).optional(),
  ketone: z.number().min(0).max(4).optional(),
  blood: z.number().min(0).max(4).optional(),
  leukocyte: z.number().min(0).max(4).optional(),
  nitrite: z.number().min(0).max(1).optional(),
  urobilinogen: z.number().min(0).max(8).optional(),
  bilirubin: z.number().min(0).max(3).optional(),
  vitamin_c: z.number().min(0).max(3).optional(),
});

const BodySchema = z.object({
  values: ValuesSchema,
  measured_at: z.string().datetime().optional(),
  source: z.enum(["analyzer", "camera"]).optional(),
  // 의료진 대리 측정 — 지정 시 측정값을 해당 환자에게 귀속 (clinician/admin/슈퍼만)
  patient_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const t = await getTranslations("apiError");
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return problem(400, "validation_error", t("badJsonBody"));
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return problem(422, "measurement_invalid", t("measurementInvalid"), parsed.error.flatten());
  }

  const { values, measured_at, source, patient_id } = parsed.data;
  const measuredAt = measured_at ? new Date(measured_at) : new Date();
  if (measuredAt.getTime() > Date.now() + 60_000) {
    return problem(422, "measurement_invalid", t("measuredAtFuture"));
  }

  const me = await getCurrentUser();
  if (!me) {
    return problem(401, "unauthorized", t("loginRequiredMeasure"));
  }

  // 대리 측정 — 대상은 담당(연결)된 사용자(b2c) 계정이어야 한다. 본인 id 로 우회 기록되지 않도록 항상 검사.
  let targetUserId = me.id;
  if (patient_id && !(patient_id === me.id && me.account_type === "b2c")) {
    if (!isStaff(me)) {
      return problem(403, "forbidden", t("measureForPatientForbidden"));
    }
    if (!(await canAccessPatient(me, patient_id))) {
      return problem(404, "patient_not_found", t("patientNotFound"));
    }
    targetUserId = patient_id;
  }

  try {
    const result = await runAnalysis({
      userId: targetUserId, raw: values, measuredAt, source,
      ...(targetUserId !== me.id ? { meta: { measured_by: me.id } } : {}),
    });
    if (targetUserId !== me.id) {
      await audit(me.id, "measure_for_patient", `patient:${targetUserId}`, { measurement_id: result.measurement_id });
    }
    return NextResponse.json({ status: "completed", ...result }, { status: 201 });
  } catch (e) {
    console.error("[measurements] analysis failed:", e);
    return problem(500, "internal_error", t("analysisInternal"));
  }
}

function problem(status: number, code: string, detail: string, extra?: unknown) {
  return NextResponse.json(
    { type: `https://errors.sdcwellcare/${code}`, title: code, status, detail, ...(extra ? { errors: extra } : {}) },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}
