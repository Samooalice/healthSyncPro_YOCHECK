// 기존 설명 레코드에 언어중립 spec 백필 (care.explanation.counterfactual.spec)
//
// 왜 필요한가
//   설명문은 측정 시점에 문장으로 만들어져 DB 에 저장된다. 다국어 전환 이전에 만들어진
//   레코드에는 spec 이 없어서, 언어를 바꿔도 그 문장만 한국어로 남는다.
//
// 왜 재분석이 아니라 백필인가
//   이 설명문은 AI 생성이 아니라 **결정론적 템플릿**이다. 조립에 쓰인 재료
//   (질환·등급·점수·표준등급·기여 피처 키·권고 목록·반사실)가 전부 DB 에 남아 있어
//   그대로 되짚어 스펙을 복원할 수 있다.
//   → **위험점수·등급·SHAP 값은 일절 건드리지 않는다.** 표시용 spec 만 추가한다.
//     (재분석 스크립트는 알고리즘이 바뀌었으면 과거 평가값을 바꿔 버린다. 의료 기록이라
//      이력이 흔들리면 안 되므로 이 방식을 택했다.)
//
// 안전장치
//   · counterfactual 의 기존 items/recommendations 는 보존하고 spec 키만 더한다 (jsonb ||)
//   · 이미 spec 이 있으면 건너뛴다 (재실행 안전)
//   · 권고 개수가 카탈로그와 어긋나면 그 레코드는 건너뛰고 보고한다 (잘못된 키 기록 방지)
//   · counterfactual 이 객체가 아닌 구 레코드는 건너뛴다 (jsonb || 가 배열에 덧붙이는 것 방지)
//   · --dry-run 으로 쓰기 없이 결과만 확인
//
// 실행: web 에서
//   node scripts/backfill-explanation-spec.mjs --dry-run
//   node scripts/backfill-explanation-spec.mjs
import { join } from "node:path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: join(process.cwd(), ".env.local"), quiet: true });
const DRY = process.argv.includes("--dry-run");

// src/config/algoParams.ts 의 explanation 설정과 같아야 한다
const TOP_K = 5;
const USER_VISIBLE_K = 3;

// src/lib/analysis/explainV2.ts 의 REC_BY_DISEASE 와 같아야 한다 (순서 포함)
const REC_BY_DISEASE = {
  kidney: ["hydration", "less_salt", "bp_glucose", "kidney_eval"],
  diabetes: ["fasting_glucose", "less_carb", "walk_after_meal", "glucose_test"],
  hypertension: ["low_salt_weight", "bp_log", "consult_uncontrolled"],
  uti: ["hydration", "no_holding", "consult_symptoms"],
  liver: ["avoid_alcohol", "liver_test"],
};

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });

async function main() {
  await client.connect();

  const { rows } = await client.query(`
    SELECT e.assessment_id, e.shap_values, e.counterfactual,
           a.disease, a.risk_grade, a.risk_score, a.standard_grade
      FROM care.explanation e
      JOIN care.risk_assessment a ON a.id = e.assessment_id
     ORDER BY e.created_at`);

  let updated = 0, skippedHasSpec = 0, skippedShape = 0;
  const warnings = [];

  for (const r of rows) {
    // ⚠️ counterfactual 이 배열인 구 레코드가 있다(Step 1 시절 형식).
    //    Postgres 의 jsonb `||` 는 배열||객체를 병합하지 않고 **객체를 원소로 덧붙인다.**
    //    그대로 두면 spec 이 배열 원소로 들어가 읽히지 않으므로, 객체가 아닌 레코드는
    //    건너뛰고 따로 보고한다(형식 정규화는 판단이 필요한 별개 작업).
    const raw = r.counterfactual;
    const isPlainObject = raw != null && typeof raw === "object" && !Array.isArray(raw);
    if (!isPlainObject) {
      skippedShape++;
      warnings.push(`${r.assessment_id}: counterfactual 이 ${Array.isArray(raw) ? "배열" : typeof raw} — 건너뜀(구 형식)`);
      continue;
    }
    const cf = raw;
    if (cf.spec) { skippedHasSpec++; continue; }

    // 기여 요인 — 저장된 shap_values 는 이미 양의 기여만 top_k 개다.
    const sv = Array.isArray(r.shap_values) ? r.shap_values : [];
    const clinicianTop = sv
      .filter((s) => Number(s?.contribution ?? 0) > 0)
      .slice(0, TOP_K)
      .map((s) => ({
        key: String(s.analyte),
        label: typeof s.feature === "string" ? s.feature : undefined,
        contribution: Number(s.contribution),
        value: s.value == null ? undefined : Number(s.value),
      }));
    const userTop = clinicianTop.slice(0, USER_VISIBLE_K).map(({ key, label }) => ({ key, label }));

    // 반사실 — 저장된 items 는 clinicianTop 순서대로 만들어졌다.
    const items = Array.isArray(cf.items) ? cf.items : [];
    const counterfactual = items
      .map((it, i) => clinicianTop[i] && ({
        key: clinicianTop[i].key,
        label: clinicianTop[i].label,
        then_grade: it?.then_grade,
      }))
      .filter(Boolean);
    if (items.length > clinicianTop.length) {
      warnings.push(`${r.assessment_id}: 반사실 ${items.length}건인데 기여요인 ${clinicianTop.length}건 — 초과분 버림`);
    }

    // 권고 — 질환별 고정 목록이므로 개수로 검증한 뒤 키로 되돌린다.
    const storedRecs = Array.isArray(cf.recommendations) ? cf.recommendations : [];
    const recKeys = REC_BY_DISEASE[r.disease] ?? [];
    let recommendations = [];
    if (storedRecs.length > 0) {
      if (storedRecs.length !== recKeys.length) {
        warnings.push(`${r.assessment_id}: 권고 ${storedRecs.length}건 vs 카탈로그 ${recKeys.length}건(${r.disease}) — 건너뜀`);
        continue;
      }
      recommendations = recKeys;
    }

    const spec = {
      v: 1,
      disease: r.disease,
      grade: r.risk_grade,
      score: Number(r.risk_score),
      standard_grade: r.standard_grade ?? null,
      userTop,
      clinicianTop,
      recommendations,
      counterfactual,
      // 비타민C 교란 여부는 저장되지 않았다. safety_notice 에만 쓰이고 화면에 노출되지
      // 않으므로 false 로 둔다. 새로 측정한 레코드는 정확한 값이 들어간다.
      vitc: false,
    };

    if (!DRY) {
      await client.query(
        `UPDATE care.explanation
            SET counterfactual = COALESCE(counterfactual, '{}'::jsonb) || jsonb_build_object('spec', $2::jsonb)
          WHERE assessment_id = $1`,
        [r.assessment_id, JSON.stringify(spec)],
      );
    }
    updated++;
  }

  console.log(`대상 ${rows.length}건`);
  console.log(`  spec 이미 있음 : ${skippedHasSpec}건`);
  console.log(`  구 형식 건너뜀 : ${skippedShape}건`);
  console.log(`  ${DRY ? "적용 예정" : "적용 완료"} : ${updated}건`);
  if (warnings.length) {
    console.log(`\n주의 ${warnings.length}건:`);
    for (const w of warnings) console.log("  - " + w);
  }
  if (DRY) console.log("\n(--dry-run: 아무것도 쓰지 않았습니다)");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => client.end());
