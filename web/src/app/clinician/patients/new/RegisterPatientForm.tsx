"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { registerPatient, type RegisterPatientState } from "../actions";
import { CONSENT_DEFS, consentLabelKey, consentDescKey } from "@/lib/auth/consent";

const INPUT = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2E5A88] focus:ring-2 focus:ring-[#2E5A88]/15";

export default function RegisterPatientForm() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<RegisterPatientState, FormData>(registerPatient, {});

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <Field label={t("auth.name")}>
        <input name="name" type="text" required placeholder={t("auth.namePlaceholder")} className={INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("patient.sex")}>
          <select name="sex" defaultValue="" className={INPUT}>
            <option value="">{t("auth.choose")}</option>
            <option value="M">{t("patient.male")}</option>
            <option value="F">{t("patient.female")}</option>
          </select>
        </Field>
        <Field label={t("portal.birthYear")}>
          <input name="birth_year" type="number" min={1900} max={2100} placeholder="1965" className={`num ${INPUT}`} />
        </Field>
      </div>
      <Field label={t("auth.email")}>
        <input name="email" type="email" required placeholder="patient@example.com" className={INPUT} />
      </Field>
      <Field label={t("portal.initialPassword")}>
        <input name="password" type="password" required minLength={8} placeholder={t("auth.passwordPlaceholder")} className={INPUT} />
        <p className="mt-1 text-xs text-gray-400">{t("portal.initialPasswordNote")}</p>
      </Field>

      <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-semibold text-gray-500">{t("portal.consentConfirmNote")}</p>
        {CONSENT_DEFS.map((c) => (
          <label key={c.type} className="flex items-start gap-2 text-sm text-gray-600">
            <input type="checkbox" name={`consent_${c.type}`} className="mt-0.5 accent-[#2E5A88]" />
            <span>
              <span className={c.required ? "font-medium text-gray-800" : ""}>{t(consentLabelKey(c.type))}</span>
              <span className="mt-0.5 block text-xs text-gray-400">{t(consentDescKey(c.type))}</span>
            </span>
          </label>
        ))}
      </div>

      {state?.error && <p className="text-sm text-[#c0392b]">⚠ {state.error}</p>}

      <button type="submit" disabled={pending}
        className="w-full rounded-lg bg-[#2E5A88] py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
        {pending ? t("portal.registering") : t("portal.registerSubmit")}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
