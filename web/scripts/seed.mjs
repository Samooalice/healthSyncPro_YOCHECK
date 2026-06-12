// 콘텐츠·큐레이션 규칙 시드 (파일럿 P0 최소 세트, 멱등)
// 원고: 1.doc 콘텐츠원고집. 데모를 위해 published/approved 로 적재.
// 주의: 실제 운영은 의료검수·RA검수 통과 후 게시(Step 5 CMS 워크플로).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });

const CONTENTS = [
  {
    id: "C-ONB-01", category: "result_explain", format: "step_guide", audience: "user",
    title: "검사결과 읽는 법",
    body: "결과는 색상과 등급으로 보여드려요. 초록은 양호, 노랑은 관찰, 주황은 주의, 빨강은 위험이 높은 편이에요. 한 번의 결과보다 추세가 중요해요. 이 서비스는 건강관리를 돕는 선별 정보를 제공하며 의료 진단을 대신하지 않아요.",
  },
  {
    id: "C-RX-PRO", category: "result_explain", format: "card", audience: "user",
    title: "요단백 결과 해설",
    body: "단백은 신장이 걸러주는 물질이에요. 운동·발열·일시적 탈수로도 잠깐 오를 수 있어요. 물을 충분히 마시고 며칠 뒤 다시 측정해 추세를 확인해 보세요. 한 번의 결과로 질환을 판단하지 않아요.",
  },
  {
    id: "C-ACT-MOD", category: "risk_action", format: "step_guide", audience: "user",
    title: "관찰 등급 행동지침",
    body: "① 물을 충분히 마시세요. ② 3일 뒤 다시 측정하세요. ③ 추세를 함께 확인해요. 한 번의 결과로 놀라거나 자가 진단하지 마세요. 14일 이내 재측정을 권장해요.",
  },
  {
    id: "C-ACT-HI", category: "risk_action", format: "step_guide", audience: "user",
    title: "주의 등급 행동지침",
    body: "① 빠른 시일 내 재측정하세요(3일 이내 권장). ② 결과를 의료진과 상의하세요. ③ 필요하면 진료의뢰 리포트를 만들어 드려요. 증상을 방치하거나 임의로 약을 조절하지 마세요.",
  },
  {
    id: "C-LIFE-KID", category: "lifestyle", format: "checklist", audience: "user",
    title: "신장 건강 생활수칙",
    body: "오늘의 미션: 물 1.5L 마시기 · 국물/짠 음식 줄이기 · 가벼운 걷기 20분. 꾸준함이 가장 큰 힘이에요.",
  },
  {
    id: "C-SAFE-01", category: "safety", format: "card", audience: "user",
    title: "선별검사 한계 안내",
    body: "본 정보는 건강관리를 돕기 위한 선별 정보이며, 의료적 진단이 아닙니다. 증상이 지속되거나 우려되면 의료진과 상담하세요.",
  },
];

const RULES = [
  { id: "rule_first_measurement", content_id: "C-ONB-01", condition: { first_time: true }, priority: 1 },
  { id: "rule_protein_moderate", content_id: "C-RX-PRO", condition: { disease: "kidney", risk_grade: ["moderate"], analyte_flags: { protein: ">=2" } }, priority: 10 },
  { id: "rule_action_moderate", content_id: "C-ACT-MOD", condition: { disease: "kidney", risk_grade: ["moderate"] }, priority: 12 },
  { id: "rule_protein_high", content_id: "C-ACT-HI", condition: { disease: "kidney", risk_grade: ["high", "very_high"] }, priority: 5 },
  { id: "rule_kidney_life", content_id: "C-LIFE-KID", condition: { disease: "kidney", risk_grade: ["moderate", "high"] }, priority: 20 },
];

async function main() {
  await client.connect();
  for (const c of CONTENTS) {
    await client.query(
      `INSERT INTO care.content (id, category, title, body, format, audience, medical_review, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,'approved','published',now())
       ON CONFLICT (id) DO UPDATE SET
         category=EXCLUDED.category, title=EXCLUDED.title, body=EXCLUDED.body,
         format=EXCLUDED.format, audience=EXCLUDED.audience, status='published', updated_at=now()`,
      [c.id, c.category, c.title, c.body, c.format, c.audience],
    );
  }
  for (const r of RULES) {
    await client.query(
      `INSERT INTO care.content_curation_rule (id, content_id, condition, priority, active)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (id) DO UPDATE SET
         content_id=EXCLUDED.content_id, condition=EXCLUDED.condition, priority=EXCLUDED.priority, active=true`,
      [r.id, r.content_id, JSON.stringify(r.condition), r.priority],
    );
  }
  console.log(`시드 완료: 콘텐츠 ${CONTENTS.length}건, 큐레이션 규칙 ${RULES.length}건.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => client.end());
