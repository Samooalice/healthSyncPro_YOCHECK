// 3명 환자 재분석 — 기존 측정/평가 삭제 후 새 다질환+PHR 엔진으로 재실행.
// 실행: npx tsx --env-file=.env.local scripts/reanalyze-patients.mts
import { prisma } from "@/lib/db";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { yocheckToInternal } from "@/lib/measurement/yocheck";

const ORG = { org: "sdc_admin", facility_code: "YC-24Q4-1334", source: "yocheck_analytics" };
const PATIENTS = [
  { pseudo: "yc-2024q4-1334-e5", name: "최은섭", examId: 5, at: "2026-06-04T18:23:00+09:00",
    raw: { blood: "음성", bilirubin: "음성", urobilinogen: "NEG", ketones: "음성", protein: "음성", nitrite: "음성", glucose: "4+", ph: "5", specific_gravity: "1.025", leukocyte: "음성", vitamin_c: "10" } },
  { pseudo: "yc-2024q4-1334-e4", name: "윤영순", examId: 4, at: "2026-06-04T18:18:00+09:00",
    raw: { blood: "음성", bilirubin: "1+", urobilinogen: "1", ketones: "음성", protein: "음성", nitrite: "음성", glucose: "음성", ph: "6", specific_gravity: "1.025", leukocyte: "1+", vitamin_c: "40" } },
  { pseudo: "yc-2024q4-1334-e3", name: "허광혁", examId: 3, at: "2026-06-04T18:13:00+09:00",
    raw: { blood: "음성", bilirubin: "1+", urobilinogen: "2", ketones: "음성", protein: "음성", nitrite: "음성", glucose: "음성", ph: "6", specific_gravity: "1.025", leukocyte: "음성", vitamin_c: "10" } },
];

async function main() {
  for (const p of PATIENTS) {
    const user = await prisma.user_account.findUnique({ where: { pseudo_id: p.pseudo } });
    if (!user) { console.log(`✗ ${p.name}: 계정 없음`); continue; }
    // 기존 분석 데이터 정리 (care_action → risk_assessment[+explanation cascade] → measurement[+correction cascade] → baseline)
    await prisma.care_action.deleteMany({ where: { user_id: user.id } });
    await prisma.risk_assessment.deleteMany({ where: { user_id: user.id } });
    await prisma.measurement.deleteMany({ where: { user_id: user.id } });
    await prisma.baseline.deleteMany({ where: { user_id: user.id } });

    const res = await runAnalysis({
      userId: user.id, raw: yocheckToInternal(p.raw), measuredAt: new Date(p.at),
      source: "analyzer", meta: { ...ORG, exam_id: p.examId, name: p.name },
    });
    const ds = res.diseases.filter((d) => d.risk_grade !== "low").map((d) => `${d.label} ${d.risk_grade}(${d.risk_score})`);
    console.log(`${p.name}: 최상위=${res.disease}/${res.risk_grade} | 위험질환: ${ds.join(", ") || "없음(모두 양호)"}`);
  }
  console.log("\n재분석 완료.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
