// 데모 계정 시드 — 환자 3(기존) + 의료진 + 슈퍼. 비밀번호 공통 'demo1234'.
// 실행: npx tsx --env-file=.env.local scripts/seed-accounts.mts
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/hash";

const PW = "demo1234";

async function main() {
  const pwHash = hashPassword(PW);

  // 1) 기존 환자 3명에 로그인 정보 부여
  const patients = [
    { pseudo: "yc-2024q4-1334-e5", name: "최은섭", email: "choi@demo.kr" },
    { pseudo: "yc-2024q4-1334-e4", name: "윤영순", email: "yoon@demo.kr" },
    { pseudo: "yc-2024q4-1334-e3", name: "허광혁", email: "heo@demo.kr" },
  ];
  for (const p of patients) {
    await prisma.user_account.update({
      where: { pseudo_id: p.pseudo },
      data: { email: p.email, display_name: p.name, password_hash: hashPassword(PW) },
    });
  }

  // 2) 의료진 계정
  await prisma.user_account.upsert({
    where: { pseudo_id: "clinician-001" },
    update: { email: "doctor@demo.kr", display_name: "김민수 · 신장내과", password_hash: pwHash, account_type: "clinician" },
    create: { pseudo_id: "clinician-001", account_type: "clinician", email: "doctor@demo.kr", display_name: "김민수 · 신장내과", password_hash: pwHash },
  });

  // 3) 슈퍼 계정 (계정 전환 가능)
  await prisma.user_account.upsert({
    where: { pseudo_id: "super-admin" },
    update: { email: "super@demo.kr", display_name: "최고관리자", password_hash: pwHash, account_type: "admin", is_super: true },
    create: { pseudo_id: "super-admin", account_type: "admin", email: "super@demo.kr", display_name: "최고관리자", password_hash: pwHash, is_super: true },
  });

  const all = await prisma.user_account.findMany({
    where: { email: { not: null } },
    select: { email: true, display_name: true, account_type: true, is_super: true },
    orderBy: { account_type: "asc" },
  });
  console.log("계정 시드 완료 (비밀번호 공통: demo1234)");
  for (const a of all) console.log(`  ${a.email}  ${a.display_name}  [${a.is_super ? "super" : a.account_type}]`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
