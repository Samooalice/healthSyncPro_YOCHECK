// 분석 오케스트레이션 v2 — 측정 → 보정(P2) → 시계열·도메인 피처 → PHR 결합
//   → 다질환 하이브리드 위험분석 → 질환별 설명 저장 → 케어액션(P5 기초).
import { prisma } from "@/lib/db";
import { ALGO_PARAMS, type Analyte } from "@/config/algoParams";
import { correctMeasurement, type RawValues } from "./correction";
import { updateBaseline, deviationSd, detectChange, type Baseline } from "./baseline";
import { computeFeatures, analyzeAll, type DiseaseResult, type PersonalSignals } from "./engine";
import { mlPredict, buildFeatures } from "./mlClient";
import { explainDisease } from "./explainV2";
import { notifyAnalysis } from "@/lib/care/notify";
import { awardMeasurement } from "@/lib/gamification/engine";
import type { PhrFlags } from "@/lib/phr/ingest";

export const MODEL_VERSION = "multi-hybrid-2026.06.01";

const ANALYTES: Analyte[] = [
  "glucose", "protein", "ph", "specific_gravity", "ketone",
  "blood", "leukocyte", "nitrite", "urobilinogen", "bilirubin", "vitamin_c",
];
const SEVERITY: Record<string, number> = { low: 0, moderate: 1, high: 2, very_high: 3 };

export interface RunInput {
  userId: string;
  raw: RawValues;
  measuredAt?: Date;
  source?: "analyzer" | "camera";
  deviceId?: string | null;
  meta?: Record<string, unknown>;
}
export interface RunResult {
  measurement_id: string;
  assessment_id: string; // 최상위 위험 질환
  disease: string;
  risk_grade: string;
  risk_score: number;
  standard_grade: string | null;
  diseases: { disease: string; label: string; risk_grade: string; risk_score: number; assessment_id: string }[];
}

export async function getOrCreateDemoUser(): Promise<string> {
  const u = await prisma.user_account.upsert({
    where: { pseudo_id: "demo-user" }, update: {}, create: { pseudo_id: "demo-user", account_type: "b2c" },
  });
  return u.id;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const toRaw = (m: Record<string, unknown>): RawValues =>
  Object.fromEntries(ANALYTES.map((a) => [a, num(m[a])]).filter(([, v]) => v != null)) as RawValues;

export async function runAnalysis(input: RunInput): Promise<RunResult> {
  const { userId, raw } = input;
  const measuredAt = input.measuredAt ?? new Date();
  const source = input.source ?? "analyzer";

  // 1) 측정 저장
  const measurement = await prisma.measurement.create({
    data: {
      user_id: userId, device_id: input.deviceId ?? null, measured_at: measuredAt, source,
      glucose: num(raw.glucose), protein: num(raw.protein), ph: num(raw.ph),
      specific_gravity: num(raw.specific_gravity), ketone: num(raw.ketone), blood: num(raw.blood),
      leukocyte: num(raw.leukocyte), nitrite: num(raw.nitrite), urobilinogen: num(raw.urobilinogen),
      bilirubin: num(raw.bilirubin), vitamin_c: num(raw.vitamin_c), meta: (input.meta ?? {}) as object,
    },
  });

  // 2) 보정(P2)
  const corr = correctMeasurement(raw);
  await prisma.correction.create({
    data: {
      measurement_id: measurement.id, measured_at: measuredAt,
      corrected: corr.corrected as object, confidence_wt: corr.confidence as object,
      sg_normalized: corr.sg_normalized, vitc_flag: corr.vitc_flag,
    },
  });

  // 2.5) P1 개인화 신호 — 기존 기준선 + 직전 이력으로 개인 편차·변화판정 산출
  const baselines = await prisma.baseline.findMany({ where: { user_id: userId } });
  const baseMap = new Map<string, Baseline>(baselines.map((b) => [b.analyte, { mean: Number(b.mean), sd: Number(b.sd), cv: b.cv == null ? 0 : Number(b.cv), n_samples: b.n_samples }]));
  const prior = await prisma.measurement.findMany({
    where: { user_id: userId, measured_at: { lt: measuredAt } }, orderBy: { measured_at: "asc" },
    select: { measured_at: true, protein: true },
  });
  // 장기 미측정 시 기준선 재설정(reset_months) — 마지막 측정 이후 경과월 초과 시 초기화
  const lastPrior = prior.length ? prior[prior.length - 1].measured_at : null;
  const gapMonths = lastPrior ? (measuredAt.getTime() - lastPrior.getTime()) / (30 * 86400_000) : 0;
  const resetBaseline = gapMonths > ALGO_PARAMS.baseline.reset_months;

  const proteinVal = num(raw.protein);
  let personal: PersonalSignals | undefined;
  if (proteinVal != null) {
    const pb = resetBaseline ? null : baseMap.get("protein") ?? null;
    const priorProteins = prior.map((p) => Number(p.protein ?? 0));
    const change = detectChange("protein", proteinVal, pb, priorProteins);
    personal = { proteinDevSd: deviationSd("protein", proteinVal, pb), proteinPersistent: change.persistent };
    // 관측 가능하도록 측정 meta에 P1 신호 기록
    await prisma.measurement.update({
      where: { id: measurement.id },
      data: { meta: { ...(input.meta ?? {}), p1: { proteinDevSd: Number(personal.proteinDevSd?.toFixed(2)), persistent: personal.proteinPersistent, baselineReset: resetBaseline } } as object },
    });
  }

  // 3) 다질환 분석·저장 (요화학 + PHR + P1 결합)
  const result = await analyzeAndPersist({ userId, measurementId: measurement.id, raw, corrected: corr.corrected, personal });

  // 4) 기준선 갱신(P1) — 신규 측정에서만(재분석 시 제외). reset 시 현재값으로 새 기준선 시작.
  for (const a of ANALYTES) {
    const x = num(raw[a]); if (x == null) continue;
    const u = updateBaseline(resetBaseline ? null : baseMap.get(a) ?? null, x);
    await prisma.baseline.upsert({
      where: { user_id_analyte: { user_id: userId, analyte: a } },
      update: { mean: u.mean, sd: u.sd, cv: u.cv, n_samples: u.n_samples },
      create: { user_id: userId, analyte: a, mean: u.mean, sd: u.sd, cv: u.cv, n_samples: u.n_samples },
    });
  }

  // 5) 게이미피케이션 적립 (스트릭·포인트·뱃지) — 신규 측정에서만, 실패해도 분석은 성공 처리
  try { await awardMeasurement(userId); } catch { /* 적립 실패 무시 */ }

  return result;
}

interface PersistInput {
  userId: string;
  measurementId: string;
  raw: RawValues;
  corrected: RawValues;
  personal?: PersonalSignals;
}

/**
 * 측정 저장(또는 PHR 갱신) 이후 공통 분석·저장.
 * 본인 PHR 플래그를 결합해 다질환 위험을 산출하고 평가·설명·케어액션·알림을 기록한다.
 * LightGBM/SHAP 서비스 우선, 장애 시 룰 엔진 폴백.
 */
async function analyzeAndPersist({ userId, measurementId, raw, corrected, personal }: PersistInput): Promise<RunResult> {
  // PHR 플래그 + 시계열 이력(오래된→최신, 현재 포함)
  const phrRec = await prisma.phr_record.findFirst({ where: { user_id: userId } });
  const phrFlags = (phrRec?.flags ?? null) as PhrFlags | null;
  const histRows = await prisma.measurement.findMany({ where: { user_id: userId }, orderBy: { measured_at: "asc" }, take: 60 });
  const history = histRows.map((m) => toRaw(m as Record<string, unknown>));

  // 피처 + 다질환 분석 — LightGBM/SHAP 서비스 우선, 장애 시 룰 엔진 폴백
  const features = computeFeatures(raw, history);
  const ml = await mlPredict(buildFeatures(raw, features, phrFlags));
  let modelVersion = MODEL_VERSION;
  let results: DiseaseResult[];
  if (ml && ml.results.length) {
    modelVersion = ml.model_version;
    results = ml.results.map((r) => ({
      disease: r.disease, label: r.label, risk_score: r.risk_score, risk_grade: r.risk_grade,
      standard_grade: r.standard_grade,
      contributions: r.shap_top.map((s) => ({ feature: s.feature_key, label: s.feature, contribution: s.shap, value: s.value })),
      is_samd_output: true,
    }));
  } else {
    results = analyzeAll(corrected, raw, features, phrFlags, personal);
  }

  // 질환별 평가·설명 저장
  const stored: RunResult["diseases"] = [];
  let topId = "", topDisease = results[0], topGrade = -1, topScore = -1;
  for (const r of results) {
    const exp = explainDisease(r, { vitcDisturbance: features.vitc_disturbance });
    const a = await prisma.risk_assessment.create({
      data: {
        user_id: userId, measurement_id: measurementId, disease: r.disease,
        risk_score: r.risk_score, risk_grade: r.risk_grade, standard_grade: r.standard_grade,
        model_version: modelVersion, is_samd_output: r.is_samd_output,
      },
    });
    await prisma.explanation.create({
      data: {
        assessment_id: a.id, shap_values: exp.shap_top as object,
        text_user: exp.text_user, text_clinician: exp.text_clinician,
        counterfactual: { items: exp.counterfactual, recommendations: exp.recommendations } as object,
      },
    });
    stored.push({ disease: r.disease, label: r.label, risk_grade: r.risk_grade, risk_score: r.risk_score, assessment_id: a.id });
    const sev = SEVERITY[r.risk_grade];
    if (sev > topGrade || (sev === topGrade && r.risk_score > topScore)) { topGrade = sev; topScore = r.risk_score; topId = a.id; topDisease = r; }
  }

  // 케어액션 — 최상위 위험 질환 기준
  await createCareActions(userId, topId, topDisease.risk_grade);

  // 알림 생성 (결과 준비 + 위험 안내)
  await notifyAnalysis(userId, { disease: topDisease.disease, risk_grade: topDisease.risk_grade, risk_score: topDisease.risk_score }, topId);

  return {
    measurement_id: measurementId, assessment_id: topId,
    disease: topDisease.disease, risk_grade: topDisease.risk_grade,
    risk_score: topDisease.risk_score, standard_grade: topDisease.standard_grade,
    diseases: stored,
  };
}

/**
 * 기존 측정을 PHR 결합 상태로 재분석한다. (PHR 신규 업로드 직후 호출)
 * 해당 측정의 기존 평가·설명·케어액션을 제거하고 종합 결과로 다시 생성한다.
 * 기준선(P1)·게이미피케이션은 측정 시점에 이미 반영되었으므로 재실행하지 않는다.
 */
export async function reanalyzeMeasurement(measurementId: string): Promise<RunResult | null> {
  const measurement = await prisma.measurement.findUnique({ where: { id: measurementId } });
  if (!measurement) return null;
  const userId = measurement.user_id;
  const correction = await prisma.correction.findFirst({ where: { measurement_id: measurementId } });
  const raw = toRaw(measurement as Record<string, unknown>);
  const corrected = (correction?.corrected ?? raw) as unknown as RawValues;

  // 기존 평가·설명·케어액션 제거(자식 → 부모 순)
  const old = await prisma.risk_assessment.findMany({ where: { measurement_id: measurementId }, select: { id: true } });
  const ids = old.map((o) => o.id);
  if (ids.length) {
    // risk_assessment 를 참조하는 자식들(explanation·care_action·referral·feedback_label)을 먼저 제거
    await prisma.explanation.deleteMany({ where: { assessment_id: { in: ids } } });
    await prisma.care_action.deleteMany({ where: { assessment_id: { in: ids } } });
    await prisma.referral.deleteMany({ where: { assessment_id: { in: ids } } });
    await prisma.feedback_label.deleteMany({ where: { assessment_id: { in: ids } } });
    await prisma.risk_assessment.deleteMany({ where: { id: { in: ids } } });
  }

  return analyzeAndPersist({ userId, measurementId, raw, corrected });
}

async function createCareActions(userId: string, assessmentId: string, grade: string) {
  const days = (n: number) => new Date(Date.now() + n * 86400000);
  type A = { action_type: string; due_at?: Date | null; payload?: object };
  const sets: Record<string, A[]> = {
    low: [{ action_type: "lifestyle" }],
    moderate: [{ action_type: "lifestyle" }, { action_type: "recheck", due_at: days(14) }],
    high: [{ action_type: "recheck", due_at: days(3) }, { action_type: "referral" }],
    very_high: [{ action_type: "emergency" }, { action_type: "referral", payload: { urgent: true } }],
  };
  for (const a of sets[grade] ?? []) {
    await prisma.care_action.create({
      data: { user_id: userId, assessment_id: assessmentId, action_type: a.action_type, grade_trigger: grade, payload: (a.payload ?? {}) as object, due_at: a.due_at ?? null },
    });
  }
}
