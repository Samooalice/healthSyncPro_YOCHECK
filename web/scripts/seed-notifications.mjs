// 알림 템플릿 적재 (notification_template). notify.ts가 {var} 치환해 렌더(없으면 인라인 폴백).
// 실행: web 에서  node scripts/seed-notifications.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });
const client = new pg.Client({ connectionString: process.env.DIRECT_URL });

// [id, channel, title, body, variables]
const T = [
  ["NT_RESULT_READY", "inapp", "검사 결과가 준비됐어요", "이번 측정 결과와 맞춤 케어를 확인해 보세요.", []],
  ["NT_RISK", "inapp", "{disease} 결과를 확인해 주세요",
    "{disease} 관련 신호가 평소보다 높게 나왔어요. 결과를 자세히 확인하고, 필요하면 의료진과 상담해 보시길 권해요.", ["disease"]],
  ["NT_RECHECK_DUE", "inapp", "재측정을 권해요",
    "추세 확인을 위해 {due}까지 다시 한 번 측정해 보시길 권해요.", ["due"]],
];

async function main() {
  await client.connect();
  for (const [id, channel, title, body, variables] of T) {
    await client.query(
      `INSERT INTO care.notification_template (id, channel, title, body, variables, active)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (id) DO UPDATE SET channel=EXCLUDED.channel, title=EXCLUDED.title,
         body=EXCLUDED.body, variables=EXCLUDED.variables, active=true`,
      [id, channel, title, body, JSON.stringify(variables)],
    );
  }
  console.log(`알림 템플릿 ${T.length}건 적재 완료.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => client.end());
