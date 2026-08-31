// 슈퍼계정 — 로그인할 계정 선택(임퍼소네이트). 환자 3 + 의료진 중 선택.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { readSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { switchTo } from "./actions";
import { logout } from "@/lib/auth/actions";
import { User, Stethoscope } from "lucide-react";

export const dynamic = "force-dynamic";

// 라벨은 accountType.* / switchPage.sub.* 카탈로그
const ROLE = {
  b2c: { Icon: User },
  clinician: { Icon: Stethoscope },
} as const;

export default async function SwitchPage() {
  const s = await readSession();
  if (!s?.superId) redirect("/login");
  const t = await getTranslations();

  const accounts = await prisma.user_account.findMany({
    where: { is_super: false, account_type: { in: ["b2c", "clinician"] } },
    orderBy: [{ account_type: "asc" }, { display_name: "asc" }],
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <span className="eyebrow">{t("switchPage.eyebrow")}</span>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-ink">{t("switchPage.title")}</h1>
        <p className="mt-2 text-sm text-body">{t("switchPage.lead")}</p>
      </div>

      <div className="space-y-3">
        {accounts.map((a) => {
          const roleKey = (a.account_type in ROLE ? a.account_type : "b2c") as keyof typeof ROLE;
          const r = ROLE[roleKey];
          return (
            <form key={a.id} action={switchTo}>
              <input type="hidden" name="id" value={a.id} />
              <button type="submit" className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-primary/40 hover:shadow-sm">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <r.Icon size={22} strokeWidth={1.75} />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-ink">{a.display_name ?? a.pseudo_id}</span>
                  <span className="block text-sm text-subtle">{t(`accountType.${roleKey}`)} · {t(`switchPage.sub.${roleKey}`)}</span>
                </span>
                <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">{t("switchPage.select")}</span>
              </button>
            </form>
          );
        })}
      </div>

      <form action={logout} className="mt-8 text-center">
        <button type="submit" className="text-sm text-subtle underline">{t("nav.logout")}</button>
      </form>
    </main>
  );
}
