// PHR 보유 사용자의 기존 측정을 재분석(비파괴) — 측정/이력 보존, 평가만 PHR 추세 결합으로 갱신.
// 실행: npx tsx --env-file=.env.local scripts/refresh-phr-reanalyze.mts
import { prisma } from "@/lib/db";
import { reanalyzeMeasurement } from "@/lib/analysis/pipeline";

async function main() {
  const phrs = await prisma.phr_record.findMany({ select: { user_id: true } });
  if (phrs.length === 0) { console.log("PHR 레코드가 없습니다."); return; }

  for (const { user_id } of phrs) {
    const user = await prisma.user_account.findUnique({ where: { id: user_id }, select: { display_name: true } });
    const name = user?.display_name ?? user_id;
    const ms = await prisma.measurement.findMany({ where: { user_id }, select: { id: true }, orderBy: { measured_at: "asc" } });
    if (ms.length === 0) { console.log(`- ${name}: 측정 없음(건너뜀)`); continue; }
    for (const m of ms) {
      const r = await reanalyzeMeasurement(m.id);
      if (r) {
        const ds = r.diseases.filter((d) => d.risk_grade !== "low").map((d) => `${d.label} ${d.risk_grade}(${d.risk_score})`);
        console.log(`✓ ${name} [${m.id.slice(0, 8)}]: 최상위=${r.disease}/${r.risk_grade}(${r.risk_score}) | 위험: ${ds.join(", ") || "없음"}`);
      }
    }
  }
  console.log("\n재분석 완료.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
