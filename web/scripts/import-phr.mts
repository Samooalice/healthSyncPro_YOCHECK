// 샘플 마이헬스데이터(PHR) 임포트 — 윤영순·최은섭. FHIR phr_*.json 병합→parsePhr→care.phr_record.
// 실행: npx tsx --env-file=.env.local scripts/import-phr.mts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { parsePhr, dedupeResources } from "@/lib/phr/ingest";

const BASE = "C:/Users/mycom/Desktop/myhealtData_yochcek/1.doc";

const TARGETS = [
  { name: "윤영순", folder: "윤영순 건강데이터" },
  { name: "최은섭", folder: "최은섭 건강데이터" },
];

function loadPublicData(folder: string): any[] {
  const dir = join(BASE, folder);
  const merged: any[] = [];
  for (const f of readdirSync(dir).filter((f) => f.startsWith("phr_") && f.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(join(dir, f), "utf8"));
    merged.push(...(d.publicData ?? []));
  }
  return merged;
}

async function main() {
  for (const t of TARGETS) {
    const user = await prisma.user_account.findFirst({ where: { display_name: t.name } });
    if (!user) { console.log(`✗ ${t.name}: 사용자 계정 없음 — 건너뜀`); continue; }

    const publicData = dedupeResources(loadPublicData(t.folder));
    const summary = parsePhr(publicData);
    const reportDate = summary.checkups[0]?.date ? new Date(summary.checkups[0].date) : null;

    const existing = await prisma.phr_record.findFirst({ where: { user_id: user.id } });
    const data = {
      user_id: user.id, source: "myhealthway", subject_name: t.name,
      report_date: reportDate, summary: summary as unknown as object, flags: summary.flags as unknown as object,
      raw: publicData as unknown as object,
    };
    if (existing) await prisma.phr_record.update({ where: { id: existing.id }, data });
    else await prisma.phr_record.create({ data });

    const f = summary.flags;
    console.log(`${t.name}: 검진${summary.checkups.length}·복약${summary.medications.length}·진단${summary.diagnoses.length} | ` +
      `flags: 당뇨=${f.diabetes} 고혈압=${f.hypertension} 이상지질=${f.dyslipidemia} 신장주의=${f.kidney_watch} | ` +
      `공복혈당=${f.glucose} eGFR=${f.egfr} BMI=${f.bmi}`);
  }
  console.log("\nPHR 임포트 완료.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
