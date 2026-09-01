// 데이터 계층 i18n 감사 — DB 에 저장된 값 중 **화면에 보이는데 번역되지 않는 것**을 찾는다.
//
// 왜 필요한가
//   scripts/i18n/i18n_scan.py 는 **소스 코드**만 본다. 그런데 이 앱은 화면 문구의 상당수가
//   DB 에서 온다(콘텐츠 본문, 생성된 설명문, 알림, PHR 파싱 결과, 피처 키…).
//   소스가 깨끗해도 데이터가 한국어면 화면은 한국어다. 그 구멍을 여기서 본다.
//
// 판정 방법
//   화면이 실제로 렌더하는 필드마다, 그 값이 카탈로그/사전에서 해석되는지 확인한다.
//   해석되지 않으면 "원문 폴백" = 비한국어 사용자에게 한국어로 보인다는 뜻이다.
//
// 실행: web 에서  node scripts/i18n-data-audit.mjs
import { join } from "node:path";
import { readFileSync } from "node:fs";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: join(process.cwd(), ".env.local"), quiet: true });

const KO = /[가-힣]/;
const ko = JSON.parse(readFileSync("messages/ko.json", "utf8"));
const has = (ns, key) => Object.prototype.hasOwnProperty.call(ko[ns] ?? {}, key);

// lib/ui/phr.ts 의 구 값 매핑과 같아야 한다
const LEGACY_MED_CLASS = { "당뇨": "diabetes", "고혈압": "hypertension", "이상지질혈증": "dyslipidemia", "위장질환": "gastro" };
// lib/ui/phr.ts 의 BP_CATEGORY 와 같아야 한다
const BP_CATEGORY = { "정상":"normal","주의혈압":"elevated","고혈압-전단계":"prehypertension","고혈압전단계":"prehypertension","고혈압":"hypertension","유질환자":"existing_condition" };
// lib/ui/phrOpinion.ts 의 정규화와 같아야 한다
const normOpinion = (s) => String(s).replace(/\s+/g, " ").replace(/([.,])(?=\S)/g, "$1 ").replace(/\s+/g, " ").trim();
const OPINION_KEYS = new Set(Object.keys(ko.phrOpinion ?? {}));
// 원문 슬러그 역인덱스는 코드에 있으므로, 여기서는 "번역된 문장 집합"으로 근사한다.
const OPINION_KO = new Set(Object.values(ko.phrOpinion ?? {}).map(normOpinion));

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
const findings = [];
const add = (area, detail, sample, verdict) => findings.push({ area, detail, sample, verdict });

async function main() {
  await client.connect();

  // ── 1. 콘텐츠 본문 (care.content → content_i18n) ────────────────────
  const t = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='care' AND table_name='content_i18n'`);
  if (!t.rowCount) {
    add("콘텐츠", "care.content_i18n 테이블 없음 (마이그레이션 0008 미적용)", "-", "FAIL");
  } else {
    const c = await client.query(`
      SELECT c.id FROM care.content c
       WHERE c.status='published'
         AND NOT EXISTS (SELECT 1 FROM care.content_i18n i WHERE i.content_id=c.id AND i.locale='ja')`);
    if (c.rowCount) add("콘텐츠", `게시 콘텐츠 중 번역 없음 ${c.rowCount}건`, c.rows.map(r=>r.id).slice(0,5).join(", "), "FAIL");
    else add("콘텐츠", "게시 콘텐츠 전부 번역 있음", "-", "OK");
  }

  // ── 2. 생성된 설명문 (spec 유무) ───────────────────────────────────
  const e = await client.query(`
    SELECT count(*)::int a,
           count(*) FILTER (WHERE jsonb_typeof(counterfactual)='object' AND counterfactual ? 'spec')::int b
      FROM care.explanation`);
  const { a, b } = e.rows[0];
  add("설명문", `spec 보유 ${b}/${a}건`, b === a ? "-" : "미보유분은 저장된 한국어로 표시", b === a ? "OK" : "WARN");

  // ── 3. 기여 피처 키 → feature.* 카탈로그 ───────────────────────────
  const sv = await client.query(`SELECT shap_values FROM care.explanation`);
  const missFeat = new Map();
  for (const r of sv.rows)
    for (const s of (Array.isArray(r.shap_values) ? r.shap_values : []))
      if (s?.analyte && !has("feature", s.analyte)) missFeat.set(s.analyte, s.feature);
  if (missFeat.size) add("피처 라벨", `카탈로그 없는 키 ${missFeat.size}종`, [...missFeat].map(([k,v])=>`${k}(${v})`).join(", "), "FAIL");
  else add("피처 라벨", "shap_values 의 모든 키가 카탈로그에 있음", "-", "OK");

  // ── 4. 알림 (template_id 로 재렌더 가능한가) ────────────────────────
  const KNOWN_TPL = new Set(["NT_RESULT_READY", "NT_RISK", "NT_REFERRAL", "NT_FEEDBACK"]);
  const n = await client.query(`SELECT DISTINCT template_id, count(*)::int c FROM care.notification GROUP BY 1`);
  const badTpl = n.rows.filter(r => !KNOWN_TPL.has(r.template_id));
  if (badTpl.length) add("알림", `재렌더 불가 template_id ${badTpl.length}종`, badTpl.map(r=>`${r.template_id}(${r.c}건)`).join(", "), "FAIL");
  else add("알림", "모든 알림이 template_id 로 재렌더 가능", "-", "OK");

  // ── 5. PHR — 화면이 그리는 필드별 ──────────────────────────────────
  const p = await client.query(`SELECT summary FROM care.phr_record`);
  const missMed = new Set(), missOpinion = new Set(), missTrend = new Set(), bpTexts = new Set();
  for (const r of p.rows) {
    const s = r.summary ?? {};
    for (const m of s.med_classes ?? []) {
      const code = LEGACY_MED_CLASS[m] ?? m;
      if (!has("medClass", code)) missMed.add(m);
    }
    for (const d of s.diagnoses ?? []) {
      if (KO.test(d) && !OPINION_KO.has(normOpinion(d))) missOpinion.add(d);
    }
    for (const tr of s.trends ?? []) if (tr?.key && !has("phrMetric", tr.key)) missTrend.add(tr.key);
    for (const ck of s.checkups ?? []) {
      const bp = ck?.metrics?.bp_text;
      if (!bp) continue;
      const m = /^([\d/.\s-]*\d)\s*(.*)$/.exec(String(bp).trim());
      const cat = m ? m[2].trim() : String(bp).trim();
      // 분류어가 사전에 있고 카탈로그에 번역이 있으면 통과
      if (cat && KO.test(cat) && !has("bpCategory", BP_CATEGORY[cat] ?? "")) bpTexts.add(String(bp));
    }
  }
  add("PHR 복약분류", missMed.size ? `해석 안 되는 값 ${missMed.size}종` : "전부 해석됨",
      missMed.size ? [...missMed].join(", ") : "-", missMed.size ? "FAIL" : "OK");
  add("PHR 소견문", missOpinion.size ? `사전에 없는 소견 ${missOpinion.size}종` : "전부 사전에 있음",
      missOpinion.size ? [...missOpinion].map(s=>s.slice(0,40)+"…").join(" / ") : "-", missOpinion.size ? "WARN" : "OK");
  add("PHR 추세라벨", missTrend.size ? `카탈로그 없는 키 ${missTrend.size}종` : "전부 카탈로그에 있음",
      missTrend.size ? [...missTrend].join(", ") : "-", missTrend.size ? "FAIL" : "OK");
  add("PHR 혈압표기", bpTexts.size ? `해석 안 되는 분류어 ${bpTexts.size}종` : "분류어 전부 해석됨",
      bpTexts.size ? [...bpTexts].join(" / ") : "-", bpTexts.size ? "WARN" : "OK");

  // ── 6. 케어 액션 / 등급 / 질환 코드 ────────────────────────────────
  for (const [label, sql, ns] of [
    ["케어 액션", `SELECT DISTINCT action_type v FROM care.care_action`, "care"],
    ["케어 상태", `SELECT DISTINCT status v FROM care.care_action WHERE status IS NOT NULL`, "careStatus"],
    ["질환 코드", `SELECT DISTINCT disease v FROM care.risk_assessment`, "disease"],
    ["위험 등급", `SELECT DISTINCT risk_grade v FROM care.risk_assessment`, "grade"],
    ["콘텐츠 분류", `SELECT DISTINCT category v FROM care.content`, "contentCategory"],
    ["콘텐츠 상태", `SELECT DISTINCT status v FROM care.content WHERE status IS NOT NULL`, "contentStatus"],
    ["계정 유형", `SELECT DISTINCT account_type v FROM care.user_account`, "accountType"],
    ["알림 분류", `SELECT DISTINCT category v FROM care.notification`, "alertCategory"],
    ["면허 종류", `SELECT DISTINCT license_type v FROM care.clinician_profile`, "license"],
  ]) {
    const r = await client.query(sql);
    const miss = r.rows.map(x => x.v).filter(v => v && !has(ns, v));
    add(label, miss.length ? `${ns}.* 에 없는 코드 ${miss.length}종` : `전부 ${ns}.* 에 있음`,
        miss.length ? miss.join(", ") : "-", miss.length ? "FAIL" : "OK");
  }

  // ── 7. 자유 입력 필드 (번역 대상 아님을 명시) ──────────────────────
  const free = await client.query(`
    SELECT count(*) FILTER (WHERE organization ~ '[가-힣]')::int org,
           count(*) FILTER (WHERE department ~ '[가-힣]')::int dept
      FROM care.clinician_profile`);
  add("의료진 프로필", `소속 ${free.rows[0].org}건 · 진료과 ${free.rows[0].dept}건이 한국어`,
      "사용자 입력값 — 번역 대상 아님", "INFO");

  // ── 출력 ───────────────────────────────────────────────────────────
  const mark = { OK: "OK  ", WARN: "WARN", FAIL: "FAIL", INFO: "INFO" };
  console.log("=".repeat(78));
  console.log(" 데이터 계층 i18n 감사 — DB 값이 화면에서 번역되는가");
  console.log("=".repeat(78));
  for (const f of findings) {
    console.log(`${mark[f.verdict]}  ${f.area.padEnd(14)} ${f.detail}`);
    if (f.sample !== "-") console.log(`      ${f.sample}`);
  }
  const fail = findings.filter(f => f.verdict === "FAIL").length;
  const warn = findings.filter(f => f.verdict === "WARN").length;
  console.log("-".repeat(78));
  console.log(`FAIL ${fail}건 · WARN ${warn}건`);
  await client.end();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
