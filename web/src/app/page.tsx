// 랜딩(메인) — 임상적 미니멀 + 에디토리얼. Pretendard/Noto Serif KR · 라인 아이콘 · 크림 팔레트.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight, Activity, FileText, Repeat, Bluetooth,
  ShieldCheck, Stethoscope, ChevronRight,
} from "lucide-react";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import type { Locale } from "@/i18n/config";

const NAV = [
  { href: "#features", key: "features" },
  { href: "#how", key: "how" },
  { href: "#clinician", key: "clinician" },
  { href: "#contact", key: "contact" },
];

const FEATURES = [
  { Icon: Activity, key: "analysis" },
  { Icon: FileText, key: "explain" },
  { Icon: Repeat, key: "loop" },
  { Icon: Bluetooth, key: "device" },
];

const STEPS = ["measure", "analyze", "understand", "act"];

/** 히어로 예시 카드의 더미 값 — 실제 측정값이 아니라 화면 예시다. */
const DEMO_ANALYTES: [string, string, number][] = [
  ["protein", "2+", 0.8],
  ["blood", "negative", 0.05],
  ["specific_gravity", "1.020", 0.4],
];
// 예시 환자 — 실제 데이터가 아니라 화면 예시다. 표기는 landing.demoPatient.* 카탈로그
// (가명 표기 관습이 언어마다 달라 번역 대상으로 둔다).
const DEMO_PATIENTS: [string, string, string, string][] = [
  ["p1", "high", "A2", "#d4691b"],
  ["p2", "moderate", "A2", "#c79100"],
  ["p3", "low", "A1", "#2e9e5b"],
];
const TRUST = ["company", "encryption", "advisory", "standards"];
const FOOTER_COLS = [
  { h: "product", links: [["measure", "/measure"], ["dashboard", "/dashboard"], ["contents", "/contents"]] },
  { h: "partner", links: [["patients", "/clinician/patients"], ["admin", "/admin"]] },
  { h: "account", links: [["login", "/login"], ["signup", "/signup"]] },
];

export default async function Landing() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  return (
    <div className="min-h-screen bg-cream">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 border-b border-line/70 bg-cream/80 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-sm font-bold text-white">W</span>
            <span className="text-[17px] font-bold tracking-tight text-ink">SDC WellCare</span>
          </Link>
          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-sm text-body transition-colors hover:text-ink">{t(`landing.nav.${n.key}`)}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <LocaleSwitcher current={locale} />
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-body transition-colors hover:text-ink">{t("auth.login")}</Link>
            <Link href="/signup" className="group inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700">
              {t("landing.getStarted")} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* 히어로 */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-[36rem] w-[36rem] rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="eyebrow">{t("landing.eyebrow")}</span>
            <h1 className="mt-5 font-serif text-[2.7rem] font-semibold leading-[1.18] text-ink sm:text-[3.4rem]">
              {t.rich("landing.heroTitle", {
                br: () => <br />,
                em: (c) => <span className="text-primary">{c}</span>,
              })}
            </h1>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-body">
              {t("landing.heroLead")}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-white shadow-sm transition hover:bg-primary-700">
                {t("landing.startFree")} <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/measure" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-7 py-3.5 font-semibold text-ink transition hover:border-ink/30">
                {t("landing.tryMeasure")}
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-subtle">{t("landing.heroDisclaimer")}</p>
          </div>

          {/* 히어로 비주얼 — 결과 화면 예시 */}
          <div className="relative">
            <span className="absolute -top-3 left-6 z-10 rounded-full bg-ink px-3 py-1 text-[11px] font-semibold tracking-wide text-white">{t("landing.sampleScreen")}</span>
            <div className="rounded-[1.75rem] border border-line bg-surface p-7 shadow-[0_24px_60px_-24px_rgba(20,36,30,0.22)]">
              <div className="flex items-center justify-between">
                <span className="eyebrow !text-subtle">{t("landing.sampleResult")}</span>
                <span className="rounded-full bg-risk-amber/10 px-3 py-1 text-xs font-bold text-risk-amber">{t("grade.moderate")}</span>
              </div>
              <div className="mt-5 flex items-end gap-3">
                <span className="num font-serif text-5xl font-semibold text-ink">0.45</span>
                <span className="pb-1.5 text-sm text-subtle">{t("landing.kidneyIndex")}</span>
              </div>
              {/* 추세 (영역 채움) */}
              <svg viewBox="0 0 300 80" className="mt-5 w-full">
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f5e57" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#1f5e57" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M6,60 L52,54 L98,57 L144,42 L190,30 L236,35 L290,16 L290,80 L6,80 Z" fill="url(#g)" />
                <polyline points="6,60 52,54 98,57 144,42 190,30 236,35 290,16" fill="none" stroke="#1f5e57" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {[[6,60],[52,54],[98,57],[144,42],[190,30],[236,35],[290,16]].map(([x,y],i)=>(
                  <circle key={i} cx={x} cy={y} r="3" fill="#faf9f5" stroke="#1f5e57" strokeWidth="2" />
                ))}
              </svg>
              <div className="mt-5 space-y-2.5">
                {DEMO_ANALYTES.map(([k, v, w]) => (
                  <div key={k} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 text-subtle">{t(`analyte.${k}`)}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-line">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${w * 100}%` }} />
                    </div>
                    <span className="num w-12 text-right text-body">{v === "negative" ? t("analyteValue.negative") : v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-primary/[0.05] p-4 text-[13px] leading-relaxed text-body">
                {t("landing.sampleComment")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 기능 */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-28">
        <div className="max-w-2xl">
          <span className="eyebrow">{t("landing.featuresEyebrow")}</span>
          <h2 className="mt-4 font-serif text-[2.1rem] font-semibold leading-snug text-ink">{t("landing.featuresTitle")}</h2>
          <p className="mt-3 text-body">{t("landing.featuresLead")}</p>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.key} className="group bg-surface p-7 transition-colors hover:bg-primary/[0.03]">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.Icon size={20} strokeWidth={1.75} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">{t(`landing.feature.${f.key}.tag`)}</span>
              </div>
              <h3 className="mt-5 text-[17px] font-bold text-ink">{t(`landing.feature.${f.key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-body">{t(`landing.feature.${f.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 작동 방식 */}
      <section id="how" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <div className="max-w-2xl">
            <span className="eyebrow">How it works</span>
            <h2 className="mt-4 font-serif text-[2.1rem] font-semibold leading-snug text-ink">{t("landing.howTitle")}</h2>
          </div>
          <div className="mt-14 grid gap-12 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s} className="relative">
                <div className="num font-serif text-3xl font-semibold text-primary/30">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="mt-3 text-lg font-bold text-ink">{t(`landing.step.${s}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{t(`landing.step.${s}.desc`)}</p>
                {i < STEPS.length - 1 && <ChevronRight size={18} className="absolute -right-6 top-1 hidden text-line md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 의료진 */}
      <section id="clinician" className="mx-auto max-w-6xl px-6 py-28">
        <div className="grid items-center gap-12 overflow-hidden rounded-[2rem] border border-line bg-ink p-12 text-white lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-white/60">
              <Stethoscope size={15} /> {t("landing.forClinicians")}
            </span>
            <h2 className="mt-4 font-serif text-[2rem] font-semibold leading-snug text-white">{t("landing.clinicianTitle")}</h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/70">
              {t("landing.clinicianLead")}
            </p>
            <Link href="/clinician/patients" className="group mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-ink transition hover:bg-white/90">
              {t("landing.clinicianCta")} <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
            <div className="mb-3 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-white/50">
              <span>{t("landing.samplePatients")}</span><span>{t("landing.byRisk")}</span>
            </div>
            <div className="space-y-2 text-sm">
              {DEMO_PATIENTS.map(([n, g, k, c]) => (
                <div key={n} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-2.5">
                  <span className="font-medium">{t(`landing.demoPatient.${n}`)}</span>
                  <span className="flex items-center gap-2 text-white/60">
                    <span className="num">{t("disease.kidney")} · {k}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: c }}>{t(`grade.${g}`)}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-white/40">
              <ShieldCheck size={13} /> {t("landing.sampleNote")}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface px-10 py-20 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
          <span className="eyebrow">{t("landing.ctaEyebrow")}</span>
          <h2 className="mx-auto mt-4 max-w-xl font-serif text-[2.3rem] font-semibold leading-snug text-ink">
            {t.rich("landing.ctaTitle", { br: () => <br /> })}
          </h2>
          <div className="mt-9 flex justify-center gap-3">
            <Link href="/signup" className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-white transition hover:bg-primary-700">
              {t("landing.startFree")} <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/measure" className="inline-flex items-center gap-2 rounded-full border border-line px-7 py-3.5 font-semibold text-ink transition hover:border-ink/30">
              {t("landing.tryMeasureShort")}
            </Link>
          </div>
        </div>
      </section>

      {/* 신뢰 스트립 (푸터 위) */}
      <div className="border-t border-line bg-surface/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 py-6 text-sm text-subtle">
          {TRUST.map((k, i) => (
            <span key={k} className="flex items-center gap-10">
              {i > 0 && <span className="text-line">/</span>}{t(`landing.trust.${k}`)}
            </span>
          ))}
        </div>
      </div>

      {/* 푸터 */}
      <footer id="contact" className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-xs font-bold text-white">W</span>
              <span className="font-bold text-ink">SDC WellCare</span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-subtle">{t.rich("landing.footerCompany", { br: () => <br /> })}</p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.h}>
              <div className="text-sm font-semibold text-ink">{t(`landing.footer.${col.h}`)}</div>
              <ul className="mt-4 space-y-2.5 text-sm text-subtle">
                {col.links.map(([l, h]) => <li key={h}><Link href={h} className="transition-colors hover:text-ink">{t(`nav.${l}`)}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-6 py-6 text-center text-[12px] leading-relaxed text-subtle">
          {t("landing.footerDisclaimer")} © 2026 SDC WellCare, Inc.
        </div>
      </footer>
    </div>
  );
}
