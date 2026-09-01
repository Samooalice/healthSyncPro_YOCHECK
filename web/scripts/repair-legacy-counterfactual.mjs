// 구 형식(배열) counterfactual 레코드 정리.
//
// 배경
//   Step 1 시절 만들어진 레코드 일부는 care.explanation.counterfactual 이 **배열**이다
//   (현재 형식은 {items, recommendations} 객체).
//   백필 초판이 `counterfactual || jsonb_build_object('spec', …)` 를 썼는데,
//   Postgres 에서 **배열 || 객체는 병합이 아니라 원소 추가**라서 spec 이
//   배열의 마지막 원소로 들어갔다. 읽히지도 않고 데이터만 지저분해졌다.
//
// 두 가지 처리 중 선택한다.
//   --revert     : 덧붙은 {spec:…} 원소만 제거해 **원래 상태로 되돌린다**.
//                  화면 문구는 저장된 한국어 그대로 유지된다. (기본 권장)
//   --normalize  : 배열을 {items, recommendations, spec} 객체로 정규화한다.
//                  6개 언어로 렌더되지만, 구세대 템플릿이라 **문구가 바뀐다.**
//
// 실행: web 에서
//   node scripts/repair-legacy-counterfactual.mjs --revert --dry-run
//   node scripts/repair-legacy-counterfactual.mjs --revert
import { join } from "node:path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: join(process.cwd(), ".env.local"), quiet: true });
const DRY = process.argv.includes("--dry-run");
const MODE = process.argv.includes("--normalize") ? "normalize"
  : process.argv.includes("--revert") ? "revert" : null;

if (!MODE) {
  console.error("모드를 지정하세요: --revert (원상복구) 또는 --normalize (객체로 정규화)");
  process.exit(2);
}

const TOP_K = 5, USER_VISIBLE_K = 3;

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });

async function main() {
  await client.connect();

  const { rows } = await client.query(`
    SELECT e.assessment_id, e.counterfactual, e.shap_values,
           a.disease, a.risk_grade, a.risk_score, a.standard_grade
      FROM care.explanation e
      JOIN care.risk_assessment a ON a.id = e.assessment_id
     WHERE jsonb_typeof(e.counterfactual) <> 'object'`);

  console.log(`구 형식 레코드 ${rows.length}건 (모드: ${MODE}${DRY ? " · dry-run" : ""})\n`);

  for (const r of rows) {
    const arr = Array.isArray(r.counterfactual) ? r.counterfactual : [];
    const original = arr.filter((el) => !(el && typeof el === "object" && "spec" in el));
    const polluted = arr.length - original.length;
    console.log(`  ${r.assessment_id}`);
    console.log(`    원소 ${arr.length}개 (덧붙은 spec ${polluted}개)`);

    let next;
    if (MODE === "revert") {
      next = original;
      console.log(`    → 배열 ${original.length}개로 복구 (spec 없음, 화면은 한국어 유지)`);
    } else {
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
      const spec = {
        v: 1,
        disease: r.disease,
        grade: r.risk_grade,
        score: Number(r.risk_score),
        standard_grade: r.standard_grade ?? null,
        userTop: clinicianTop.slice(0, USER_VISIBLE_K).map(({ key, label }) => ({ key, label })),
        clinicianTop,
        recommendations: [],
        // 구 형식 배열은 지금 반사실 스키마와 대응이 확실하지 않아 비운다.
        counterfactual: [],
        vitc: false,
      };
      next = { items: original, recommendations: [], spec };
      console.log(`    → 객체 {items:${original.length}, recommendations:0, spec} 로 정규화 (문구가 바뀐다)`);
    }

    if (!DRY) {
      await client.query(
        `UPDATE care.explanation SET counterfactual = $2::jsonb WHERE assessment_id = $1`,
        [r.assessment_id, JSON.stringify(next)],
      );
    }
  }

  console.log(DRY ? "\n(--dry-run: 아무것도 쓰지 않았습니다)" : `\n${rows.length}건 처리 완료.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => client.end());
