"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupClinician, type ClinicianSignupState } from "./actions";
import { CLINICIAN_CONSENT_DEFS } from "@/lib/auth/consent";

const LICENSE_OPTIONS = [
  { value: "doctor", label: "의사" },
  { value: "nurse", label: "간호사" },
  { value: "medtech", label: "임상병리사" },
];

export default function ClinicianSignupPage() {
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
          <h2 className="font-serif text-3xl font-semibold leading-snug text-white">의료진 포털<br />가입 신청</h2>
          <p className="mt-4 max-w-sm text-white/75">환자 모니터링·임상 리포트·만성질환 관리를 위한 의료진 전용 계정입니다.</p>
          <p className="mt-3 max-w-sm text-sm text-white/60">환자 건강정보(PHI) 보호를 위해 면허 확인 후 관리자 승인 절차를 거칩니다.</p>
        </div>
        <p className="text-xs text-white/50">© 2026 SDC WellCare, Inc.</p>
      </div>

      {/* 우: 폼 */}
      <div className="flex items-center justify-center bg-cream px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/signup" className="text-sm text-subtle">← 일반 회원가입</Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">의료진 가입 신청</h1>
          <p className="mt-1 text-sm text-body">면허 확인 후 관리자 승인이 완료되면 포털을 이용할 수 있습니다.</p>

          {state?.ok ? (
            <div className="mt-7 rounded-2xl border border-line bg-surface p-6 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-teal-50 text-2xl text-teal-600">✓</div>
              <h2 className="text-lg font-bold text-ink">신청이 접수되었습니다</h2>
              <p className="mt-2 text-sm leading-relaxed text-body">
                관리자가 면허 정보를 확인한 뒤 승인하면 등록하신 이메일 계정으로 로그인할 수 있어요.
                승인 전에는 로그인이 제한됩니다.
              </p>
              <Link href="/login" className="mt-5 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700">
                로그인 화면으로
              </Link>
            </div>
          ) : (
            <form action={formAction} className="mt-7 space-y-4">
              <Field name="name" label="이름" type="text" placeholder="홍길동" />
              <Field name="email" label="이메일" type="email" placeholder="you@hospital.com" />
              <Field name="password" label="비밀번호" type="password" placeholder="8자 이상" />

              <div>
                <label className="mb-1 block text-sm font-medium text-ink">면허 종류</label>
                <select name="license_type" required defaultValue=""
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">
                  <option value="" disabled>선택하세요</option>
                  {LICENSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <Field name="license_no" label="면허(자격) 번호" type="text" placeholder="예: 제12345호" />
              <Field name="organization" label="소속 의료기관" type="text" placeholder="OO병원 / OO의원" />
              <Field name="department" label="진료과 (선택)" type="text" placeholder="내과, 신장내과 등" required={false} />

              <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
                {CLINICIAN_CONSENT_DEFS.map((c) => (
                  <label key={c.type} className="flex items-start gap-2 text-sm text-body">
                    <input type="checkbox" name={`consent_${c.type}`} defaultChecked={false} className="mt-0.5 accent-[var(--color-primary)]" />
                    <span>
                      <span className="font-medium text-ink">{c.label}</span>
                      <span className="mt-0.5 block text-xs text-subtle">{c.desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              {state?.error && <p className="text-sm text-risk-red">⚠ {state.error}</p>}

              <button type="submit" disabled={pending}
                className="w-full rounded-lg bg-primary py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
                {pending ? "신청 중…" : "가입 신청"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-body">
            이미 계정이 있으신가요? <Link href="/login" className="font-semibold text-primary">로그인</Link>
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
