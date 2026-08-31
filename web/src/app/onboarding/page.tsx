// 온보딩 — 가입 직후 환영·검사결과 읽는 법(C-ONB-01)·시작 안내. (기기 등록은 마이에서)
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guard";
import { Droplet, LineChart, ShieldCheck, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

// 문구는 onboarding.step.<key>.title | .desc 카탈로그
const STEPS = [
  { key: "measure", Icon: Droplet },
  { key: "read", Icon: LineChart },
  { key: "safety", Icon: ShieldCheck },
];

export default async function OnboardingPage() {
  const me = await requireUser();
  const t = await getTranslations();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="text-center">
        <span className="eyebrow">{t("onboarding.welcome")}</span>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-ink">{me.display_name ? t("onboarding.greetNamed", { name: me.display_name }) : t("onboarding.greet")}</h1>
        <p className="mt-2 text-body">{t("onboarding.lead")}</p>
      </div>

      <div className="mt-10 space-y-3">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <s.Icon size={20} strokeWidth={1.75} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="num text-xs font-bold text-subtle">0{i + 1}</span>
                <h3 className="font-bold text-ink">{t(`onboarding.step.${s.key}.title`)}</h3>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-body">{t(`onboarding.step.${s.key}.desc`)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link href="/measure" className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-white transition hover:bg-primary-700">
          {t("dashboard.startFirst")} <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link href="/dashboard" className="inline-flex items-center rounded-full border border-line bg-surface px-7 py-3.5 font-semibold text-ink transition hover:border-ink/30">
          {t("onboarding.toDashboard")}
        </Link>
      </div>
    </main>
  );
}
