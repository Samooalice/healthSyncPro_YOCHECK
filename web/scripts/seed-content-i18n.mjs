// 콘텐츠 번역 적재 (care.content_i18n) — 마이그레이션 0008 선행 필요.
// 기준어(ko)는 care.content 본체에 있고, 여기서는 번역만 얹는다.
// 번역이 없는 콘텐츠는 화면에서 ko 로 폴백하므로, 부분 적재도 안전하다.
//
// 실행: web 에서  node scripts/seed-content-i18n.mjs
//        node scripts/seed-content-i18n.mjs en ja      (일부 언어만)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });
const client = new pg.Client({ connectionString: process.env.DIRECT_URL });

const ALL_LOCALES = ["en", "ja", "vi", "zh-Hans", "zh-Hant"];
const DATA_DIR = join(__dirname, "data", "content-i18n");

const locales = process.argv.slice(2).length ? process.argv.slice(2) : ALL_LOCALES;

async function main() {
  await client.connect();

  // 마이그레이션 선행 확인 — 없으면 무엇을 해야 하는지 알려주고 종료한다.
  const { rows: t } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='care' AND table_name='content_i18n'`,
  );
  if (t.length === 0) {
    console.error("care.content_i18n 테이블이 없습니다. 먼저 마이그레이션을 적용하세요:");
    console.error("  npm run db:migrate   (db/migrations/0008_i18n.sql)");
    process.exit(1);
  }

  const { rows: known } = await client.query(`SELECT id FROM care.content`);
  const knownIds = new Set(known.map((r) => r.id));

  let total = 0;
  for (const locale of locales) {
    const f = join(DATA_DIR, `${locale}.json`);
    if (!existsSync(f)) {
      console.warn(`- ${locale}: 데이터 파일 없음 (${f}) — 건너뜀`);
      continue;
    }
    const data = JSON.parse(readFileSync(f, "utf8"));
    let n = 0;
    const missing = [];
    for (const [id, v] of Object.entries(data)) {
      if (!knownIds.has(id)) { missing.push(id); continue; }
      await client.query(
        `INSERT INTO care.content_i18n (content_id, locale, title, body, payload)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (content_id, locale) DO UPDATE
           SET title=EXCLUDED.title, body=EXCLUDED.body, payload=EXCLUDED.payload, updated_at=now()`,
        [id, locale, v.title, v.body ?? null, v.payload ? JSON.stringify(v.payload) : null],
      );
      n++;
    }
    total += n;
    console.log(`- ${locale}: ${n}건 적재${missing.length ? ` (미존재 콘텐츠 ${missing.length}건 건너뜀: ${missing.join(", ")})` : ""}`);
  }

  // 커버리지 보고 — 언어별로 몇 %가 번역됐는지
  const { rows: cov } = await client.query(
    `SELECT locale, count(*)::int AS n FROM care.content_i18n GROUP BY locale ORDER BY locale`,
  );
  console.log(`\n콘텐츠 ${knownIds.size}건 기준 번역 커버리지`);
  for (const r of cov) {
    console.log(`  ${r.locale.padEnd(9)} ${String(r.n).padStart(3)}건  ${Math.round((r.n / knownIds.size) * 100)}%`);
  }
  console.log(`\n총 ${total}건 적재 완료.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => client.end());
