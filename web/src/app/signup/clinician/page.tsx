"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signupClinician, type ClinicianSignupState } from "./actions";
import { CLINICIAN_CONSENT_DEFS, consentLabelKey, consentDescKey } from "@/lib/auth/consent";

// 면허 종류 — 표시 문구는 license.* 카탈로그
const LICENSE_OPTIONS = ["doctor", "nurse", "medtech"];

export default function ClinicianSignupPage() {
  const t = useTranslations("auth");
  const tc = useTranslations();
  const [state, formAction, pending] = useActionState<ClinicianSignupState, FormData>(signupClinician, {});

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* 좌: 브랜드 패널 */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-sm font-bold">W</span>
          <span className="text-lg font-bold">SDC WellCare</span>
        </Link>
        <div>
          <h2 className="font-serif text-3xl font-semibold leading-snug text-white">{t.rich("clinPanelTitle", { br: () => <br /> })}</h2>
          <p className="mt-4 max-w-sm text-white/75">{t("clinPanelLead")}</p>
          <p className="mt-3 max-w-sm text-sm text-white/60">{t("clinPanelNote")}</p>
        </div>
        <p className="text-xs text-white/50">© 2026 SDC WellCare, Inc.</p>
      </div>

      {/* 우: 폼 */}
      <div className="flex items-center justify-center bg-cream px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/signup" className="text-sm text-subtle">← {t("toGeneralSignup")}</Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">{t("clinicianSignup")}</h1>
          <p className="mt-1 text-sm text-body">{t("clinLead")}</p>

          {state?.ok ? (
            <div className="mt-7 rounded-2xl border border-line bg-surface p-6 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-teal-50 text-2xl text-teal-600">✓</div>
              <h2 className="text-lg font-bold text-ink">{t("clinSubmitted")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-body">
                {t("clinSubmittedNote")}
              </p>
              <Link href="/login" className="mt-5 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700">
                {t("toLoginScreen")}
              </Link>
            </div>
          ) : (
            <form action={formAction} className="mt-7 space-y-4">
              <Field name="name" label={t("name")} type="text" placeholder={t("namePlaceholder")} />
              <Field name="email" label={t("email")} type="email" placeholder="you@hospital.com" />
              <Field name="password" label={t("password")} type="password" placeholder={t("passwordPlaceholder")} />

              <div>
                <label className="mb-1 block text-sm font-medium text-ink">{t("licenseTypeLabel")}</label>
                <select name="license_type" required defaultValue=""
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">
                  <option value="" disabled>{t("choose")}</option>
                  {LICENSE_OPTIONS.map((o) => <option key={o} value={o}>{tc(`license.${o}`)}</option>)}
                </select>
              </div>
              <Field name="license_no" label={t("licenseNo")} type="text" placeholder={t("licenseNoPlaceholder")} />
              <Field name="organization" label={t("organization")} type="text" placeholder={t("organizationPlaceholder")} />
              <Field name="department" label={t("department")} type="text" placeholder={t("departmentPlaceholder")} required={false} />

              <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
                {CLINICIAN_CONSENT_DEFS.map((c) => (
                  <label key={c.type} className="flex items-start gap-2 text-sm text-body">
                    <input type="checkbox" name={`consent_${c.type}`} defaultChecked={false} className="mt-0.5 accent-[var(--color-primary)]" />
                    <span>
                      <span className="font-medium text-ink">{tc(consentLabelKey(c.type))}</span>
                      <span className="mt-0.5 block text-xs text-subtle">{tc(consentDescKey(c.type))}</span>
                    </span>
                  </label>
                ))}
              </div>

              {state?.error && <p className="text-sm text-risk-red">⚠ {state.error}</p>}

              <button type="submit" disabled={pending}
                className="w-full rounded-lg bg-primary py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
                {pending ? t("submitting") : t("submitApplication")}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-body">
            {t("haveAccount")} <Link href="/login" className="font-semibold text-primary">{t("login")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ name, label, type, placeholder, required = true }: { name: string; label: string; type: string; placeholder: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <input name={name} type={type} required={required} placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
    </div>
  );
}
