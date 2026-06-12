// =====================================================================
// care 스키마 raw SQL 마이그레이션 러너
// - 공유 Supabase 인스턴스에서 Prisma migrate 와 충돌 없이 의료 스키마를
//   우리가 직접 관리(SaMD 변경관리 추적성). 적용 이력은 care.schema_migration.
// - 사용: web 디렉터리에서  `npm run db:migrate`
// - DIRECT_URL(5432, 세션 연결)로 DDL 적용.
// =====================================================================
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const migrationsDir = join(repoRoot, 'db', 'migrations');

// .env.local 우선, 없으면 .env
dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

const conn = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!conn) {
  console.error('✗ DIRECT_URL(또는 DATABASE_URL) 환경변수가 없습니다. web/.env.local 확인.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: conn });

async function main() {
  await client.connect();
  await client.query('CREATE SCHEMA IF NOT EXISTS care');
  await client.query(`
    CREATE TABLE IF NOT EXISTS care.schema_migration (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const applied = new Set(
    (await client.query('SELECT filename FROM care.schema_migration')).rows.map((r) => r.filename)
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const f of files) {
    if (applied.has(f)) {
      console.log(`= skip   ${f} (이미 적용)`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, f), 'utf8');
    process.stdout.write(`+ apply  ${f} ... `);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO care.schema_migration(filename) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log('OK');
      count++;
    } catch (e) {
      await client.query('ROLLBACK');
      console.log('FAIL');
      console.error(`\n✗ ${f} 적용 실패:\n${e.message}\n`);
      process.exit(1);
    }
  }
  console.log(`\n완료: ${count}건 신규 적용, 전체 ${files.length}건.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
