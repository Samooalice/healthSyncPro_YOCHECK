// POST /api/v1/measurements — 측정 업로드 → 동기 분석 파이프라인 실행.
// 인증은 Step 2에서 추가. 현재는 데모 사용자 사용.
import { NextResponse } from "next/server";
import { z } from "zod";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { getCurrentUser } from "@/lib/auth/session";

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
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return problem(400, "validation_error", "JSON 본문을 파싱할 수 없습니다.");
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return problem(422, "measurement_invalid", "측정값 검증 실패", parsed.error.flatten());
  }

  const { values, measured_at, source } = parsed.data;
  const measuredAt = measured_at ? new Date(measured_at) : new Date();
  if (measuredAt.getTime() > Date.now() + 60_000) {
    return problem(422, "measurement_invalid", "측정 시각은 미래일 수 없습니다.");
  }

  const me = await getCurrentUser();
  if (!me) {
    return problem(401, "unauthorized", "로그인이 필요합니다. 측정은 본인 계정으로만 저장됩니다.");
  }

  try {
    const result = await runAnalysis({ userId: me.id, raw: values, measuredAt, source });
    return NextResponse.json({ status: "completed", ...result }, { status: 201 });
  } catch (e) {
    console.error("[measurements] analysis failed:", e);
    return problem(500, "internal_error", "분석 처리 중 오류가 발생했습니다.");
  }
}

function problem(status: number, code: string, detail: string, extra?: unknown) {
  return NextResponse.json(
    { type: `https://errors.sdcwellcare/${code}`, title: code, status, detail, ...(extra ? { errors: extra } : {}) },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}
