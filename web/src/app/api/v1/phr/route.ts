// POST /api/v1/phr — 로그인 사용자의 나의건강기록(FHIR PHR) 업로드.
// 출처: sdc_deploy yocheck_analytics phr_upload. 다중 파일/통합 JSON 모두 허용.
//   각 파일 → extractPublicData → 병합. 기존 raw + 신규 → dedupeResources(누적, 덮어쓰기 아님)
//   → parsePhr → 본인 phr_record upsert(summary·flags·raw) → 측정 재분석 → 종합 assessment_id 반환.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { parsePhr, extractPublicData, dedupeResources, phrOwnerName } from "@/lib/phr/ingest";
import { reanalyzeMeasurement } from "@/lib/analysis/pipeline";
import { getTranslations } from "next-intl/server";

export async function POST(req: Request) {
  const t = await getTranslations("apiError");
  const me = await getCurrentUser();
  if (!me) return problem(401, "unauthorized", t("loginRequired"));

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return problem(400, "validation_error", t("badJsonBody"));
  }
  const body = (json ?? {}) as Record<string, unknown>;

  try {
  // 업로드 형태: { datasets: [파일1JSON, 파일2JSON, ...] } (다중 파일) 또는
  //   단일 JSON({publicData}/{entry}/배열) 그대로도 허용(하위호환).
  const datasets: unknown[] = Array.isArray(body.datasets)
    ? body.datasets
    : [Array.isArray(json) ? json : json];

  // 각 파일에서 FHIR 리소스 추출 → 신규 병합
  const incoming: unknown[] = [];
  for (const d of datasets) incoming.push(...extractPublicData(d));
  if (incoming.length === 0) {
    return problem(422, "phr_invalid", t("phrInvalid"));
  }

  // 명의 확인 — 업로드 PHR의 주인(Patient.name)과 로그인 계정 이름이 둘 다 있고 다르면 거부
  const norm = (s?: string | null) => (s ?? "").replace(/\s+/g, "");
  const ownerName = phrOwnerName(incoming);
  if (norm(ownerName) && norm(me.display_name) && norm(ownerName) !== norm(me.display_name)) {
    return problem(409, "phr_name_mismatch",
      t("phrOwnerMismatch", { owner: ownerName, account: me.display_name ?? "" }));
  }

  // 누적 병합 — 기존 raw + 신규 → 중복 제거(덮어쓰기 아님)
  const existing = await prisma.phr_record.findFirst({ where: { user_id: me.id } });
  const prior: unknown[] = Array.isArray(existing?.raw) ? (existing!.raw as unknown[]) : [];
  const before = dedupeResources(prior).length;
  const combined = dedupeResources([...prior, ...incoming]);
  const added = combined.length - before;

  // 재파싱(통합본 기준)
  const summary = parsePhr(combined);
  if (summary.checkups.length === 0 && summary.medications.length === 0 && summary.diagnoses.length === 0) {
    return problem(422, "phr_empty", t("phrEmpty"));
  }

  const reportDate = summary.checkups[0]?.date ? new Date(summary.checkups[0].date) : null;
  const data = {
    user_id: me.id, source: "myhealthway", subject_name: summary.patient.name || me.display_name || null,
    report_date: reportDate,
    summary: summary as unknown as object, flags: summary.flags as unknown as object,
    raw: combined as unknown as object,
  };
  if (existing) await prisma.phr_record.update({ where: { id: existing.id }, data });
  else await prisma.phr_record.create({ data });

  // 재분석 대상 측정: 지정값(현재 보던 결과) 우선, 없으면 최신 측정
  let measurementId: string | null = typeof body.measurement_id === "string" ? body.measurement_id : null;
  if (measurementId) {
    const owned = await prisma.measurement.findFirst({ where: { id: measurementId, user_id: me.id }, select: { id: true } });
    if (!owned) measurementId = null;
  }
  if (!measurementId) {
    const latest = await prisma.measurement.findFirst({ where: { user_id: me.id }, orderBy: { measured_at: "desc" }, select: { id: true } });
    measurementId = latest?.id ?? null;
  }

  let assessmentId: string | null = null;
  if (measurementId) {
    const result = await reanalyzeMeasurement(measurementId);
    assessmentId = result?.assessment_id ?? null;
  }

  return NextResponse.json({
    status: "ok",
    has_measurement: !!measurementId,
    assessment_id: assessmentId,
    resource_total: combined.length,
    resource_added: existing ? added : combined.length,
    is_merge: !!existing,
    checkups: summary.checkups.length,
    medications: summary.medications.length,
    diagnoses: summary.diagnoses,
    flags: summary.flags,
  }, { status: 201 });
  } catch (e) {
    console.error("[phr] upload failed:", e);
    return problem(500, "internal_error", t("phrInternal"));
  }
}

function problem(status: number, code: string, detail: string, extra?: unknown) {
  return NextResponse.json(
    { type: `https://errors.sdcwellcare/${code}`, title: code, status, detail, ...(extra ? { errors: extra } : {}) },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}
