// Prisma 7 설정 — introspection/migrate 전용 연결 정의.
// 런타임 쿼리는 src/lib/db.ts 의 PrismaPg 어댑터(DATABASE_URL)를 사용.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next 관례인 .env.local 을 우선 로드
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  // 우리는 raw SQL 러너(scripts/migrate.mjs)로 care 스키마를 관리하므로
  // prisma migrate 는 사용하지 않는다. db pull(introspect)만 활용.
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
