// 콘텐츠 전체 적재 (콘텐츠원고집 기반) + 질환별 큐레이션 규칙.
// 대부분 published(검수완료)로 적재하되, 일부는 검수 대기 상태로 두어 CMS 워크플로 시연.
// 실행: web 에서  node scripts/seed-content-full.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });
const client = new pg.Client({ connectionString: process.env.DIRECT_URL });

// [id, category, format, audience, title, body, status?]
const C = [
  ["C-ONB-01", "result_explain", "step_guide", "user", "검사결과 읽는 법",
    "결과는 색상과 등급으로 보여드려요. 초록은 양호, 노랑은 관찰, 주황은 주의, 빨강은 위험이 높은 편이에요. 한 번의 결과보다 추세가 중요해요. 이 서비스는 건강관리를 돕는 선별 정보를 제공하며 의료 진단을 대신하지 않아요."],
  // 결과 해설 (요화학)
  ["C-RX-PRO", "result_explain", "card", "user", "요단백 결과 해설",
    "단백은 신장이 걸러주는 물질이에요. 운동·발열·일시적 탈수로도 잠깐 오를 수 있어요. 물을 충분히 마시고 며칠 뒤 다시 측정해 추세를 확인해 보세요. 한 번의 결과로 질환을 판단하지 않아요."],
  ["C-RX-GLU", "result_explain", "card", "user", "요당 결과 해설",
    "식사 직후 일시적으로 당이 나올 수 있어요. 반복되면 혈당 관리를 살펴보는 것이 좋아요. 공복 상태에서 다시 측정해 보고, 반복되면 혈당 검사를 권해요. 소변검사만으로 당뇨를 진단하지 않아요."],
  ["C-RX-BLD", "result_explain", "card", "user", "잠혈 결과 해설",
    "격렬한 운동이나 생리 등 일시적 요인으로도 나타날 수 있어요. 비타민C가 결과에 영향을 줄 수 있어 보정에 반영했어요. 반복되면 신장·요로 건강을 살펴보는 것이 좋아요."],
  ["C-RX-LEU", "result_explain", "card", "user", "백혈구 결과 해설",
    "요로의 염증이나 감염과 관련될 수 있는 신호예요. 특히 아질산염과 함께 나오면 함께 살펴봐요. 수분을 충분히 섭취하고, 배뇨 시 통증·빈뇨 등 증상이 있으면 의료진과 상담해 보세요."],
  ["C-RX-KET", "result_explain", "card", "user", "케톤 결과 해설",
    "공복이 길거나 수분·탄수화물 섭취가 적을 때 나타날 수 있어요. 당뇨가 있는 경우 혈당 관리 상태를 함께 살피는 것이 좋아요."],
  ["C-RX-NIT", "result_explain", "card", "user", "아질산염 결과 해설",
    "일부 세균이 만들어내는 물질로 요로감염과 관련될 수 있어요. 백혈구 반응과 함께 보면 더 정확해요. 증상이 있으면 의료진 상담을 권해요."],
  ["C-RX-PH", "result_explain", "card", "user", "산도(pH) 결과 해설",
    "소변의 산도는 식습관·수분 상태에 따라 자연스럽게 오르내려요. 정상은 대략 4.5~8.0 범위예요. 한 번의 값보다 추세가 중요하고, 지속적으로 한쪽으로 치우치면 결석·감염 단서일 수 있어 추세를 살펴봐요."],
  ["C-RX-SG", "result_explain", "card", "user", "비중 결과 해설",
    "비중은 소변이 얼마나 농축됐는지를 보여줘요. 물을 적게 마시면 높아지고, 많이 마시면 낮아져요. 정상은 대략 1.005~1.030이에요. 다른 항목 해석에도 영향을 줘서 수분 상태를 함께 살펴요."],
  ["C-RX-URO", "result_explain", "card", "user", "유로빌리노겐 결과 해설",
    "유로빌리노겐은 간·담도와 관련된 물질이에요. 살짝 검출되는 것은 정상일 수 있어요. 빌리루빈과 함께 높게 나오면 간 건강을 살펴보는 것이 좋아요. 한 번의 결과로 판단하지 않아요."],
  ["C-RX-BIL", "result_explain", "card", "user", "빌리루빈 결과 해설",
    "빌리루빈이 소변에서 검출되면 간·담도 신호일 수 있어요. 정상에서는 거의 나오지 않아요. 반복되면 간기능 혈액검사를 의료진과 상담해 보시길 권해요."],
  ["C-RX-VITC", "result_explain", "card", "user", "비타민C 영향 안내",
    "비타민C를 많이 드시면 시험지의 잠혈·요당 반응이 실제보다 낮게(위음성) 나올 수 있어요. 그래서 분석 시 이 영향을 보정에 반영해요. 검사 전날 고용량 비타민C 섭취는 피하면 더 정확해요."],
  // 질환 교육
  ["C-EDU-KID", "disease_edu", "article", "user", "만성신장질환 이해하기",
    "신장은 노폐물과 여분의 수분을 걸러 소변으로 내보내는 장기예요. 초기에는 증상이 거의 없어 소변검사로 단백·잠혈 같은 이른 신호를 살피는 것이 도움이 돼요. 충분한 수분, 짠 음식 줄이기, 혈압·혈당 관리, 정기 측정이 좋아요. 단백뇨가 반복되면 의료진과 상담해 보세요."],
  ["C-EDU-DM", "disease_edu", "article", "user", "당뇨와 소변검사",
    "당뇨는 혈당이 정상보다 높게 유지되는 상태예요. 혈당이 높으면 소변으로 당이 넘쳐 나올 수 있어요. 요당·케톤이 반복되면 혈당 관리를 점검하는 계기가 돼요. 규칙적 식사, 적정 탄수화물, 꾸준한 활동이 도움이 돼요. 소변검사만으로 당뇨를 진단하지 않아요."],
  ["C-EDU-HTN", "disease_edu", "article", "user", "고혈압과 신장 건강",
    "고혈압과 신장은 서로 영향을 주고받아요. 혈압이 오래 높으면 신장 여과기능에 영향을 줄 수 있고, 그 신호가 소변의 단백으로 나타나기도 해요. 저염식·규칙적 운동·적정 체중·절주·금연이 혈압 관리에 도움이 돼요."],
  ["C-EDU-UTI", "disease_edu", "article", "user", "요로감염 알아보기",
    "요로감염은 소변길에 세균이 들어가 염증이 생기는 상태예요. 백혈구·아질산염 반응이 이른 신호가 될 수 있어요. 충분한 수분, 배뇨를 오래 참지 않기, 청결 유지가 도움이 돼요. 배뇨통·빈뇨·발열이 있으면 의료진과 상담해 보세요.", "medical_review"],
  // 생활관리
  ["C-LIFE-KID", "lifestyle", "checklist", "user", "신장 건강 생활수칙",
    "오늘의 미션: 물 1.5L 마시기 · 국물/짠 음식 줄이기 · 가벼운 걷기 20분 · 혈압 기록하기. 작은 습관이 신장 건강을 지켜요."],
  ["C-LIFE-HYD", "lifestyle", "checklist", "user", "수분 관리 미션",
    "기상 후 물 한 잔 · 식사마다 물 챙기기 · 카페인 음료 줄이기 · 하루 목표 수분량 달성. 소변 색이 옅은 노란색이면 수분이 충분하다는 신호예요."],
  ["C-LIFE-DM", "lifestyle", "checklist", "user", "혈당 친화 생활수칙",
    "규칙적인 식사 시간 지키기 · 정제 탄수화물·단 음료 줄이기 · 식후 가벼운 활동 10분 · 혈당 기록하기. 식후 가벼운 움직임이 혈당 관리에 도움이 돼요."],
  // 행동지침
  ["C-ACT-LOW", "risk_action", "step_guide", "user", "양호 등급 행동지침",
    "지금처럼 잘 관리하고 계세요. ① 평소 생활습관을 유지하세요. ② 정기적으로 측정해 추세를 이어가세요. ③ 오늘의 미션으로 좋은 습관을 더해 보세요. 양호한 결과도 꾸준한 기록이 가장 큰 힘이에요."],
  ["C-ACT-MOD", "risk_action", "step_guide", "user", "관찰 등급 행동지침",
    "① 물을 충분히 마시세요. ② 3일 뒤 다시 측정하세요. ③ 추세를 함께 확인해요. 한 번의 결과로 놀라거나 자가 진단하지 마세요. 14일 이내 재측정을 권장해요."],
  ["C-ACT-HI", "risk_action", "step_guide", "user", "주의 등급 행동지침",
    "① 빠른 시일 내 재측정하세요(3일 이내 권장). ② 결과를 의료진과 상의해 보시길 권해요. ③ 필요하면 진료의뢰 요약을 만들어 드려요. 증상을 방치하거나 임의로 약을 조절하지 마세요."],
  ["C-ACT-VHI", "risk_action", "step_guide", "user", "높음 등급 행동지침",
    "위험 신호가 뚜렷해요. ① 결과를 자세히 확인하세요. ② 의료진과 상담해 보시길 권해요. ③ 진료에 도움이 되는 요약 리포트를 준비해 드려요. 이 안내는 진단이 아니에요."],
  // 안전·동기
  ["C-SAFE-01", "safety", "card", "user", "선별검사 한계 안내",
    "본 정보는 건강관리를 돕기 위한 선별 정보이며, 의료적 진단이 아닙니다. 한 번의 결과보다 여러 번의 추세가 중요해요. 증상이 지속되거나 우려되면 의료진과 상담해 보시길 권해요."],
  ["C-MOT-IMP", "motivation", "card", "user", "위험이 낮아졌어요!",
    "꾸준한 관리가 결과로 나타났어요. 정말 잘하고 계세요. 이 흐름을 이어가 볼까요?"],
  ["C-MOT-STREAK", "motivation", "card", "user", "연속 측정 축하",
    "작은 습관이 쌓여 큰 건강을 만들어요. 꾸준함을 이어가신 것을 축하해요!", "draft"],
  ["C-MOT-FIRST", "motivation", "card", "user", "첫 측정을 축하해요",
    "건강 관리의 첫걸음을 내디뎠어요! 첫 측정은 내 몸 상태를 알아가는 시작점이에요. 앞으로 추세가 쌓이면 더 정확한 안내를 드릴 수 있어요."],
  ["C-MOT-BADGE", "motivation", "card", "user", "새 뱃지 획득!",
    "꾸준한 측정과 미션 실천으로 새로운 뱃지를 얻었어요. 작은 성취가 모여 건강 습관이 됩니다. 다음 뱃지에도 도전해 볼까요?"],
  ["C-MOT-GOAL", "motivation", "card", "user", "건강 목표 세우기",
    "나만의 건강 목표(예: 요단백 음성 유지)를 정하면 동기가 더 커져요. 오늘의 미션이 목표로 가는 작은 발걸음이에요."],
  // 보호자
  ["C-CARE-01", "caregiver", "card", "caregiver", "보호자 알림 요약",
    "가족의 최근 측정 결과를 요약해 알려드려요. 등급에 따라 안내된 행동을 함께 챙겨 주시면 도움이 돼요. 이 서비스는 선별 정보를 제공하며 진단을 대신하지 않아요."],
  ["C-CARE-GUIDE", "caregiver", "article", "caregiver", "보호자를 위한 케어 안내",
    "가족의 측정을 도울 때는 같은 시간대에 규칙적으로 측정하도록 도와주세요. 결과 등급에 따라 ① 양호·관찰이면 생활관리와 재측정을 함께 챙기고, ② 주의·높음이면 의료진 상담을 권유하며 진료에 필요한 요약을 함께 준비해 주세요. 보호자가 대신 진단·치료를 결정하지 않으며, 최종 판단은 의료진과 함께해요."],
];

// [rule_id, content_id, condition(JSON), priority]
const R = [
  ["rule_first_measurement", "C-ONB-01", { first_time: true }, 1],
  ["rule_protein_moderate", "C-RX-PRO", { disease: "kidney", risk_grade: ["moderate", "high"], analyte_flags: { protein: ">=2" } }, 10],
  ["rule_action_moderate", "C-ACT-MOD", { risk_grade: ["moderate"] }, 14],
  ["rule_action_high", "C-ACT-HI", { risk_grade: ["high"] }, 6],
  ["rule_action_vhigh", "C-ACT-VHI", { risk_grade: ["very_high"] }, 2],
  ["rule_kidney_edu", "C-EDU-KID", { disease: "kidney", risk_grade: ["moderate", "high", "very_high"] }, 20],
  ["rule_kidney_life", "C-LIFE-KID", { disease: "kidney", risk_grade: ["moderate", "high"] }, 22],
  ["rule_glucose", "C-RX-GLU", { analyte_flags: { glucose: ">=2" } }, 12],
  ["rule_diabetes_edu", "C-EDU-DM", { disease: "diabetes", risk_grade: ["moderate", "high", "very_high"] }, 11],
  ["rule_diabetes_life", "C-LIFE-DM", { disease: "diabetes", risk_grade: ["moderate", "high", "very_high"] }, 21],
  ["rule_htn_edu", "C-EDU-HTN", { disease: "hypertension", risk_grade: ["moderate", "high", "very_high"] }, 13],
  ["rule_uti_signal", "C-RX-LEU", { analyte_flags: { leukocyte: ">=2", nitrite: ">=1" } }, 8],
  ["rule_uti_edu", "C-EDU-UTI", { disease: "uti", risk_grade: ["moderate", "high"] }, 15],
  ["rule_risk_improved", "C-MOT-IMP", { risk_trend: "improved" }, 16],
  ["rule_streak_7", "C-MOT-STREAK", { streak_days: ">=7" }, 18],
  ["rule_action_low", "C-ACT-LOW", { risk_grade: ["low"] }, 30],
  ["rule_first_motivation", "C-MOT-FIRST", { first_time: true }, 9],
];

async function main() {
  await client.connect();
  for (const [id, category, format, audience, title, body, status] of C) {
    const st = status ?? "published";
    const mr = st === "published" ? "approved" : "pending";
    const pub = st === "published" ? "now()" : "NULL";
    await client.query(
      `INSERT INTO care.content (id, category, title, body, format, audience, medical_review, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${pub})
       ON CONFLICT (id) DO UPDATE SET category=EXCLUDED.category, title=EXCLUDED.title, body=EXCLUDED.body,
         format=EXCLUDED.format, audience=EXCLUDED.audience, medical_review=EXCLUDED.medical_review,
         status=EXCLUDED.status, published_at=${pub === "now()" ? "now()" : "care.content.published_at"}, updated_at=now()`,
      [id, category, title, body, format, audience, mr, st],
    );
  }
  for (const [rid, cid, cond, prio] of R) {
    await client.query(
      `INSERT INTO care.content_curation_rule (id, content_id, condition, priority, active)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (id) DO UPDATE SET content_id=EXCLUDED.content_id, condition=EXCLUDED.condition, priority=EXCLUDED.priority, active=true`,
      [rid, cid, JSON.stringify(cond), prio],
    );
  }
  const pub = (await client.query("SELECT count(*) FROM care.content WHERE status='published'")).rows[0].count;
  const rev = (await client.query("SELECT count(*) FROM care.content WHERE status<>'published'")).rows[0].count;
  console.log(`콘텐츠 ${C.length}건(게시 ${pub}·검수대기 ${rev}), 큐레이션 규칙 ${R.length}건 적재 완료.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => client.end());
