// 슈퍼계정 — 로그인할 계정 선택(임퍼소네이트). 환자 3 + 의료진 중 선택.
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { switchTo } from "./actions";
import { logout } from "@/lib/auth/actions";
import { User, Stethoscope } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLE = {
  b2c: { label: "사용자", Icon: User, sub: "측정·결과·케어" },
  clinician: { label: "의료진", Icon: Stethoscope, sub: "환자 모니터링·임상 리포트" },
} as const;

export default async function SwitchPage() {
  const s = await readSession();
  if (!s?.superId) redirect("/login");

  const accounts = await prisma.user_account.findMany({
    where: { is_super: false, account_type: { in: ["b2c", "clinician"] } },
    orderBy: [{ account_type: "asc" }, { display_name: "asc" }],
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <span className="eyebrow">슈퍼계정 로그인됨</span>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-ink">어느 계정으로 들어갈까요?</h1>
        <p className="mt-2 text-sm text-body">선택한 계정으로 전환해 화면을 확인합니다. 언제든 다시 전환할 수 있어요.</p>
      </div>

      <div className="space-y-3">
        {accounts.map((a) => {
          const r = ROLE[(a.account_type as keyof typeof ROLE)] ?? ROLE.b2c;
          return (
            <form key={a.id} action={switchTo}>
              <input type="hidden" name="id" value={a.id} />
              <button type="submit" className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-primary/40 hover:shadow-sm">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <r.Icon size={22} strokeWidth={1.75} />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-ink">{a.display_name ?? a.pseudo_id}</span>
                  <span className="block text-sm text-subtle">{r.label} · {r.sub}</span>
                </span>
                <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">선택</span>
              </button>
            </form>
          );
        })}
      </div>

      <form action={logout} className="mt-8 text-center">
        <button type="submit" className="text-sm text-subtle underline">로그아웃</button>
      </form>
    </main>
  );
}
