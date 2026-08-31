"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { login, type LoginState } from "./actions";

// 데모 계정 — 설명 문구는 auth.demo.<key> 카탈로그 (이메일·이름은 데이터라 번역하지 않는다)
const DEMO = [
  { email: "super@demo.kr", key: "super" },
  { email: "doctor@demo.kr", key: "doctor" },
  { email: "choi@demo.kr", key: "user" },
];

export default function LoginPage() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* 좌: 브랜드 패널 */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-sm font-bold">W</span>
          <span className="text-lg font-bold">SDC WellCare</span>
        </Link>
        <div>
          <h2 className="font-serif text-3xl font-semibold leading-snug text-white">{t.rich("loginPanelTitle", { br: () => <br /> })}</h2>
          <p className="mt-4 max-w-sm text-white/75">{t("loginPanelLead")}</p>
        </div>
        <p className="text-xs text-white/50">© 2026 SDC WellCare, Inc.</p>
      </div>

      {/* 우: 폼 */}
      <div className="flex items-center justify-center bg-cream px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="text-sm text-subtle">← {t("toHome")}</Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">{t("login")}</h1>
          <p className="mt-1 text-sm text-body">{t("loginLead")}</p>

          <form action={formAction} className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">{t("email")}</label>
              <input name="email" type="email" required defaultValue="super@demo.kr"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">{t("password")}</label>
              <input name="password" type="password" required defaultValue="demo1234"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </div>
            {state?.error && <p className="text-sm text-risk-red">⚠ {state.error}</p>}
            <button type="submit" disabled={pending}
              className="w-full rounded-lg bg-primary py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
              {pending ? t("loggingIn") : t("login")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-body">
            {t("noAccount")} <Link href="/signup" className="font-semibold text-primary">{t("signup")}</Link>
            <span className="px-1.5 text-subtle">·</span>
            <Link href="/signup/clinician" className="font-semibold text-primary">{t("clinicianSignupShort")}</Link>
          </p>

          {/* 데모 계정 안내 */}
          <div className="mt-6 rounded-xl border border-line bg-surface p-4">
            <div className="mb-2 text-xs font-semibold text-subtle">{t("demoAccounts")}</div>
            <ul className="space-y-1 text-xs text-body">
              {DEMO.map((d) => <li key={d.email}><span className="num font-medium text-ink">{d.email}</span> — {t(`demo.${d.key}`)}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
