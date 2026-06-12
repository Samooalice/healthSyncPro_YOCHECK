// yocheck_analytics 실측 데이터 임포트 (3명, 2026-06-04)
// 출처: sdc_admin · YC-24Q4-1334 검사 목록. 값은 측정기 표기 그대로 두고
// yocheckToInternal 로 내부 코드 변환 후 분석 파이프라인 실행.
// 실행: web 에서  npx tsx scripts/import-yocheck.mts
import { prisma } from "@/lib/db";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { yocheckToInternal } from "@/lib/measurement/yocheck";

interface Patient {
  pseudo_id: string;
  name: string;
  examId: number;
  measuredAt: string; // ISO (KST)
  raw: Record<string, string>; // 측정기 표기값
}

const ORG = { org: "sdc_admin", facility_code: "YC-24Q4-1334", source: "yocheck_analytics" };

// 컬럼순: blood, bilirubin, urobilinogen, ketones, protein, nitrite, glucose, ph, specific_gravity, leukocyte, vitamin_c
const PATIENTS: Patient[] = [
  {
    pseudo_id: "yc-2024q4-1334-e5", name: "최은섭", examId: 5, measuredAt: "2026-06-04T18:23:00+09:00",
    raw: { blood: "음성", bilirubin: "음성", urobilinogen: "NEG", ketones: "음성", protein: "음성",
           nitrite: "음성", glucose: "4+", ph: "5", specific_gravity: "1.025", leukocyte: "음성", vitamin_c: "10" },
  },
  {
    pseudo_id: "yc-2024q4-1334-e4", name: "윤영순", examId: 4, measuredAt: "2026-06-04T18:18:00+09:00",
    raw: { blood: "음성", bilirubin: "1+", urobilinogen: "1", ketones: "음성", protein: "음성",
           nitrite: "음성", glucose: "음성", ph: "6", specific_gravity: "1.025", leukocyte: "1+", vitamin_c: "40" },
  },
  {
    pseudo_id: "yc-2024q4-1334-e3", name: "허광혁", examId: 3, measuredAt: "2026-06-04T18:13:00+09:00",
    raw: { blood: "음성", bilirubin: "1+", urobilinogen: "2", ketones: "음성", protein: "음성",
           nitrite: "음성", glucose: "음성", ph: "6", specific_gravity: "1.025", leukocyte: "음성", vitamin_c: "10" },
  },
];

async function main() {
  for (const p of PATIENTS) {
    // 계정 + PII(이름) 보장
    const acct = await prisma.user_account.upsert({
      where: { pseudo_id: p.pseudo_id },
      update: {},
      create: { pseudo_id: p.pseudo_id, account_type: "b2c" },
    });
    await prisma.user_pii.upsert({
      where: { user_id: acct.id },
      update: { name_enc: Buffer.from(p.name, "utf8") },
      create: { user_id: acct.id, name_enc: Buffer.from(p.name, "utf8") },
    });

    // 멱등: 이미 임포트된 사용자면 건너뜀
    const existing = await prisma.measurement.findFirst({ where: { user_id: acct.id } });
    if (existing) {
      console.log(`${p.name} (exam ${p.examId}): 이미 임포트됨 — 건너뜀`);
      continue;
    }

    const values = yocheckToInternal(p.raw);
    const result = await runAnalysis({
      userId: acct.id,
      raw: values,
      measuredAt: new Date(p.measuredAt),
      source: "analyzer",
      meta: { ...ORG, exam_id: p.examId, name: p.name },
    });
    console.log(
      `${p.name} (exam ${p.examId}): grade=${result.risk_grade} score=${result.risk_score} ` +
      `kdigo=${result.standard_grade} | 변환값 ${JSON.stringify(values)}`,
    );
  }
  console.log(`\n임포트 완료: ${PATIENTS.length}명.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
