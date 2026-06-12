"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type SignupState } from "./actions";
import { CONSENT_DEFS } from "@/lib/auth/consent";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signup, {});

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* 좌: 브랜드 패널 */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-sm font-bold">W</span>
          <span className="text-lg font-bold">SDC WellCare</span>
        </Link>
        <div>
          <h2 className="font-serif text-3xl font-semibold leading-snug text-white">건강 관리의<br />첫걸음을 함께</h2>
          <p className="mt-4 max-w-sm text-white/75">간단한 가입으로 측정·분석·맞춤 케어를 시작하세요.</p>
        </div>
        <p className="text-xs text-white/50">© 2026 SDC WellCare, Inc.</p>
      </div>

      {/* 우: 폼 */}
      <div className="flex items-center justify-center bg-cream px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="text-sm text-subtle">← 홈으로</Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">회원가입</h1>
          <p className="mt-1 text-sm text-body">계정을 만들고 건강 관리를 시작하세요.</p>

          <form action={formAction} className="mt-7 space-y-4">
            <Field name="name" label="이름" type="text" placeholder="홍길동" />
            <Field name="email" label="이메일" type="email" placeholder="you@example.com" />
            <Field name="password" label="비밀번호" type="password" placeholder="8자 이상" />

            <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
              {CONSENT_DEFS.map((c) => (
                <label key={c.type} className="flex items-start gap-2 text-sm text-body">
                  <input type="checkbox" name={`consent_${c.type}`} defaultChecked={c.required} className="mt-0.5 accent-[var(--color-primary)]" />
                  <span>
                    <span className={c.required ? "font-medium text-ink" : ""}>{c.label}</span>
                    <span className="mt-0.5 block text-xs text-subtle">{c.desc}</span>
                  </span>
                </label>
              ))}
            </div>

            {state?.error && <p className="text-sm text-risk-red">⚠ {state.error}</p>}

            <button type="submit" disabled={pending}
              className="w-full rounded-lg bg-primary py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
              {pending ? "가입 중…" : "회원가입"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-body">
            이미 계정이 있으신가요? <Link href="/login" className="font-semibold text-primary">로그인</Link>
          </p>
          <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-center text-sm text-body">
            의료진이신가요? <Link href="/signup/clinician" className="font-semibold text-primary">의료진 가입 신청 →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ name, label, type, placeholder }: { name: string; label: string; type: string; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <input name={name} type={type} required placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
    </div>
  );
}
