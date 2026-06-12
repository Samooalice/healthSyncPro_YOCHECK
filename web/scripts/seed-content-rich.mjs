// 콘텐츠 리치화 — 형식별 구조화 payload (아티클 섹션·퀴즈 문항·체크리스트 미션).
// 출처: 콘텐츠원고집 2부(아티클)·3부(미션)·6부(퀴즈).
// 실행: web 에서  node scripts/seed-content-rich.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });
const client = new pg.Client({ connectionString: process.env.DIRECT_URL });

// ── 아티클 섹션 (기존 disease_edu 콘텐츠 payload 갱신) ──
const ARTICLES = {
  "C-EDU-KID": { source: "대한신장학회 등 공신력 있는 임상 가이드라인(검수 시 확정)", sections: [
    ["정의", "신장은 노폐물과 여분의 수분을 걸러 소변으로 내보내는 장기예요. 이 여과 기능이 서서히 떨어지는 상태를 만성신장질환이라고 해요."],
    ["왜 중요한가", "초기에는 증상이 거의 없어 모르고 지나치기 쉬워요. 그래서 소변검사로 단백·잠혈 같은 이른 신호를 정기적으로 살피는 것이 도움이 돼요."],
    ["소변검사와의 관련", "단백뇨와 잠혈은 신장이 보내는 이른 신호일 수 있어요. 한 번의 결과보다 여러 번의 추세가 중요해요."],
    ["생활 속 관리", "충분한 수분 섭취, 짠 음식 줄이기, 혈압·혈당 관리, 정기적인 측정이 도움이 돼요. 적정 체중 유지와 금연도 좋아요."],
    ["언제 의료진과 상담하나", "단백뇨가 반복되거나, 부종·거품뇨가 지속되면 의료진과 상담해 보시길 권해요."],
  ] },
  "C-EDU-DM": { source: "대한당뇨병학회 등 임상 가이드라인(검수 시 확정)", sections: [
    ["정의", "당뇨는 혈액 속 포도당(혈당)이 정상보다 높게 유지되는 상태예요. 혈당이 높으면 소변으로 당이 넘쳐 나올 수 있어요."],
    ["왜 중요한가", "서서히 진행되며 초기 증상이 뚜렷하지 않을 수 있어요. 소변에서 당·케톤이 반복되면 혈당 관리를 점검하는 계기가 돼요."],
    ["소변검사와의 관련", "요당은 혈당이 높을 때 나타날 수 있어요. 식사 직후 일시적으로도 나와, 공복 측정과 추세 확인이 중요해요. 소변검사만으로 당뇨를 진단하지 않아요."],
    ["생활 속 관리", "규칙적인 식사와 적정 탄수화물, 꾸준한 신체활동, 적정 체중 유지가 도움이 돼요."],
    ["언제 의료진과 상담하나", "요당이 반복되거나 갈증·잦은 소변·체중 변화가 함께 있으면 혈당 검사를 위해 상담해 보세요."],
  ] },
  "C-EDU-HTN": { source: "고혈압·신장 관련 임상 가이드라인(검수 시 확정)", sections: [
    ["정의", "고혈압은 혈관에 가해지는 압력이 지속적으로 높은 상태예요. 신장은 혈압 조절에 중요한 역할을 해요."],
    ["왜 중요한가", "혈압이 오래 높으면 신장 여과기능에 영향을 줄 수 있고, 그 신호가 소변의 단백으로 나타나기도 해요."],
    ["소변검사와의 관련", "단백뇨는 신장이 받는 부담의 이른 신호일 수 있어요. 고혈압을 관리한다면 소변의 단백 추세를 함께 살피면 도움이 돼요."],
    ["생활 속 관리", "저염식, 규칙적 운동, 적정 체중, 절주, 금연이 혈압 관리에 도움이 돼요. 혈압을 정기적으로 기록하는 습관도 좋아요."],
    ["언제 의료진과 상담하나", "단백뇨가 반복되거나 혈압이 잘 조절되지 않으면 의료진과 상담해 보세요."],
  ] },
  "C-EDU-UTI": { source: "요로감염 관련 임상 가이드라인(검수 시 확정)", sections: [
    ["정의", "요로감염은 소변이 지나가는 길(요도·방광 등)에 세균이 들어가 염증이 생기는 상태예요."],
    ["왜 중요한가", "흔하지만 불편한 증상을 일으키고, 방치하면 위로 번질 수 있어요. 백혈구·아질산염 반응이 이른 신호가 돼요."],
    ["소변검사와의 관련", "백혈구는 염증을, 아질산염은 일부 세균 활동을 시사할 수 있어요. 둘이 함께 나오면 가능성을 더 살펴봐요."],
    ["생활 속 관리", "충분한 수분 섭취, 소변을 오래 참지 않기, 청결 유지가 도움이 돼요."],
    ["언제 의료진과 상담하나", "배뇨 시 통증, 빈뇨, 잔뇨감, 발열 등이 있으면 의료진과 상담해 보세요."],
  ] },
};

// ── 체크리스트 미션 (lifestyle payload 갱신) ──
const CHECKLISTS = {
  "C-LIFE-KID": { intro: "작은 습관이 신장 건강을 지켜요. 오늘 할 수 있는 것부터 시작해요.", missions: [
    ["M-KID-1", "물 1.5L 마시기", 5, "일일"], ["M-KID-2", "국물·짠 음식 줄이기", 5, "일일"],
    ["M-KID-3", "가벼운 걷기 20분", 5, "일일"], ["M-KID-4", "혈압 기록하기", 10, "주 3회"], ["M-KID-5", "정기 소변 측정", 10, "주 2회"],
  ] },
  "C-LIFE-HYD": { intro: "수분은 신장이 일하는 데 꼭 필요해요. 오늘 충분히 마셔 볼까요?", missions: [
    ["M-HYD-1", "기상 후 물 한 잔", 3, "일일"], ["M-HYD-2", "식사마다 물 챙기기", 3, "일일"],
    ["M-HYD-3", "카페인 음료 줄이기", 5, "일일"], ["M-HYD-4", "하루 목표 수분량 달성", 10, "일일"],
  ] },
  "C-LIFE-DM": { intro: "혈당을 안정적으로 지키는 습관을 함께 만들어요.", missions: [
    ["M-DM-1", "규칙적인 식사 시간 지키기", 5, "일일"], ["M-DM-2", "정제 탄수화물·단 음료 줄이기", 5, "일일"],
    ["M-DM-3", "식후 가벼운 활동 10분", 5, "일일"], ["M-DM-4", "혈당 기록하기", 10, "주 3회"],
  ] },
};

// ── 퀴즈 (신규 콘텐츠) ──  [id, title, disease-relevant, questions]
const QUIZZES = [
  ["C-EDU-KID-Q", "신장 건강 퀴즈", [
    ["신장의 주요 역할은 무엇일까요?", [["노폐물과 수분을 걸러 소변으로 내보낸다", true], ["산소를 온몸에 운반한다", false], ["음식을 소화시킨다", false]], "신장은 여과 기관으로, 노폐물과 여분의 수분을 걸러내요."],
    ["만성신장질환의 초기 특징으로 맞는 것은?", [["통증이 매우 심하다", false], ["증상이 거의 없어 모르고 지나치기 쉽다", true], ["항상 발열이 동반된다", false]], "초기에는 증상이 거의 없어 정기 측정이 중요해요."],
    ["소변검사에서 신장 신호로 살펴보는 항목은?", [["단백·잠혈", true], ["비타민C", false], ["pH만", false]], "단백뇨와 잠혈이 신장의 이른 신호일 수 있어요."],
  ]],
  ["C-EDU-DM-Q", "당뇨와 소변 퀴즈", [
    ["소변에 당이 나올 수 있는 경우는?", [["혈당이 높을 때나 식사 직후 일시적으로", true], ["물을 많이 마셨을 때만", false], ["운동을 했을 때만", false]], "혈당이 높으면 소변으로 당이 넘쳐 나올 수 있어요."],
    ["케톤이 소변에 나오는 상황은?", [["공복이 길거나 탄수화물 섭취가 적을 때", true], ["잠을 많이 잤을 때", false], ["물을 많이 마셨을 때", false]], "몸이 당 대신 지방을 에너지로 쓸 때 케톤이 나와요."],
    ["소변검사로 당뇨를 확진할 수 있을까요?", [["네, 바로 확진할 수 있다", false], ["아니요, 선별 신호이며 혈당 검사가 필요하다", true], ["케톤이 있으면 확진된다", false]], "소변검사는 선별 도구이며 진단은 혈당 검사 등으로 해요."],
  ]],
  ["C-EDU-HTN-Q", "고혈압과 신장 퀴즈", [
    ["고혈압과 신장의 관계로 맞는 것은?", [["서로 무관하다", false], ["서로 영향을 주고받는다", true], ["신장만 혈압에 영향을 준다", false]], "신장은 혈압 조절에 관여하고, 높은 혈압은 신장에 부담을 줘요."],
    ["고혈압 관리 시 소변에서 함께 살피면 좋은 항목은?", [["단백", true], ["비타민C", false], ["케톤", false]], "단백뇨는 신장이 받는 부담의 이른 신호일 수 있어요."],
  ]],
  ["C-EDU-UTI-Q", "요로감염 퀴즈", [
    ["요로감염과 관련될 수 있는 소변 항목은?", [["백혈구·아질산염", true], ["비중·pH", false], ["빌리루빈", false]], "백혈구는 염증을, 아질산염은 일부 세균 활동을 시사할 수 있어요."],
    ["요로감염 예방에 도움이 되는 습관은?", [["소변을 오래 참기", false], ["충분한 수분 섭취와 소변을 참지 않기", true], ["물을 적게 마시기", false]], "수분 섭취와 규칙적 배뇨가 도움이 돼요."],
  ]],
];

async function main() {
  await client.connect();
  // 아티클
  for (const [id, a] of Object.entries(ARTICLES)) {
    await client.query(`UPDATE care.content SET payload=$2, updated_at=now() WHERE id=$1`,
      [id, JSON.stringify({ kind: "article", sections: a.sections.map(([h, t]) => ({ h, t })), source: a.source })]);
  }
  // 체크리스트
  for (const [id, c] of Object.entries(CHECKLISTS)) {
    await client.query(`UPDATE care.content SET format='checklist', payload=$2, updated_at=now() WHERE id=$1`,
      [id, JSON.stringify({ kind: "checklist", intro: c.intro, missions: c.missions.map(([mid, text, points, repeat]) => ({ id: mid, text, points, repeat })) })]);
  }
  // 퀴즈 (신규)
  for (const [id, title, qs] of QUIZZES) {
    const payload = JSON.stringify({ kind: "quiz", questions: qs.map(([q, options, explain]) => ({ q, options: options.map(([t, correct]) => ({ t, correct })), explain })) });
    await client.query(
      `INSERT INTO care.content (id, category, title, body, format, audience, medical_review, status, published_at, payload)
       VALUES ($1,'disease_edu',$2,$3,'quiz','user','approved','published',now(),$4)
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, body=EXCLUDED.body, format='quiz', status='published', payload=EXCLUDED.payload, updated_at=now()`,
      [id, title, `${title} — 객관식 ${qs.length}문항으로 가볍게 확인해 보세요.`, payload]);
  }
  console.log(`리치 콘텐츠 적재: 아티클 ${Object.keys(ARTICLES).length} · 체크리스트 ${Object.keys(CHECKLISTS).length} · 퀴즈 ${QUIZZES.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => client.end());
