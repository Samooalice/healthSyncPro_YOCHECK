// 랜딩(메인) — 임상적 미니멀 + 에디토리얼. Pretendard/Noto Serif KR · 라인 아이콘 · 크림 팔레트.
import Link from "next/link";
import {
  ArrowRight, Activity, FileText, Repeat, Bluetooth,
  ShieldCheck, Stethoscope, ChevronRight,
} from "lucide-react";

const NAV = [
  { href: "#features", label: "기능" },
  { href: "#how", label: "작동 방식" },
  { href: "#clinician", label: "의료진" },
  { href: "#contact", label: "문의" },
];

const FEATURES = [
  { Icon: Activity, title: "개인화 위험분석", desc: "요화학 11종을 개인 기준선과 비교해 신장·당뇨·요로감염 위험을 조기에 살핍니다.", tag: "분석" },
  { Icon: FileText, title: "설명가능 리포트", desc: "왜 그런 결과인지 기여 항목과 쉬운 언어·의료진 근거를 함께 제공합니다.", tag: "설명" },
  { Icon: Repeat, title: "케어 폐루프", desc: "등급별 행동지침·재측정·진료의뢰까지 측정에서 행동으로 이어집니다.", tag: "케어" },
  { Icon: Bluetooth, title: "측정기 연동", desc: "요화학 측정기와 직접 연결해 수기 입력 없이 측정·분석합니다.", tag: "연동" },
];

const STEPS = [
  { n: "01", title: "측정", desc: "측정기와 연결해 소변 11종을 측정합니다." },
  { n: "02", title: "분석", desc: "보정과 개인화 AI로 위험을 계층화합니다." },
  { n: "03", title: "이해", desc: "쉬운 해설과 근거로 결과를 이해합니다." },
  { n: "04", title: "행동", desc: "맞춤 케어와 콘텐츠로 관리를 실천합니다." },
];

export default function Landing() {
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
              <a key={n.href} href={n.href} className="text-sm text-body transition-colors hover:text-ink">{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-body transition-colors hover:text-ink">로그인</Link>
            <Link href="/signup" className="group inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700">
              시작하기 <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* 히어로 */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-[36rem] w-[36rem] rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="eyebrow">요화학 11종 · 개인화 AI</span>
            <h1 className="mt-5 font-serif text-[2.7rem] font-semibold leading-[1.18] text-ink sm:text-[3.4rem]">
              소변검사 한 번으로,<br />
              만성질환을 <span className="text-primary">미리</span> 살핍니다
            </h1>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-body">
              요화학분석기 측정값을 개인화 AI로 분석해 신장·당뇨·고혈압 위험을 조기에 탐지하고,
              이해하기 쉬운 설명과 맞춤 케어로 연결합니다.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-white shadow-sm transition hover:bg-primary-700">
                무료로 시작하기 <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/measure" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-7 py-3.5 font-semibold text-ink transition hover:border-ink/30">
                측정 체험하기
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-subtle">선별 정보 제공 서비스이며 의료 진단을 대신하지 않습니다.</p>
          </div>

          {/* 히어로 비주얼 — 결과 화면 예시 */}
          <div className="relative">
            <span className="absolute -top-3 left-6 z-10 rounded-full bg-ink px-3 py-1 text-[11px] font-semibold tracking-wide text-white">예시 화면</span>
            <div className="rounded-[1.75rem] border border-line bg-surface p-7 shadow-[0_24px_60px_-24px_rgba(20,36,30,0.22)]">
              <div className="flex items-center justify-between">
                <span className="eyebrow !text-subtle">측정 결과 예시</span>
                <span className="rounded-full bg-risk-amber/10 px-3 py-1 text-xs font-bold text-risk-amber">관찰 필요</span>
              </div>
              <div className="mt-5 flex items-end gap-3">
                <span className="num font-serif text-5xl font-semibold text-ink">0.45</span>
                <span className="pb-1.5 text-sm text-subtle">신장 위험 지수 · KDIGO A2</span>
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
                {[["요단백", "2+", 0.8], ["잠혈", "음성", 0.05], ["비중", "1.020", 0.4]].map(([k, v, w]) => (
                  <div key={k as string} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 text-subtle">{k}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-line">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(w as number) * 100}%` }} />
                    </div>
                    <span className="num w-12 text-right text-body">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-primary/[0.05] p-4 text-[13px] leading-relaxed text-body">
                단백 수치가 평소보다 조금 높아요. 며칠 뒤 재측정해 추세를 확인해 보세요.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 기능 */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-28">
        <div className="max-w-2xl">
          <span className="eyebrow">측정 · 분석 · 이해 · 행동</span>
          <h2 className="mt-4 font-serif text-[2.1rem] font-semibold leading-snug text-ink">끊김 없는 케어 폐루프</h2>
          <p className="mt-3 text-body">특허기술(P1~P5)을 실제 제품 경험으로 옮겼습니다.</p>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group bg-surface p-7 transition-colors hover:bg-primary/[0.03]">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.Icon size={20} strokeWidth={1.75} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">{f.tag}</span>
              </div>
              <h3 className="mt-5 text-[17px] font-bold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-body">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 작동 방식 */}
      <section id="how" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <div className="max-w-2xl">
            <span className="eyebrow">How it works</span>
            <h2 className="mt-4 font-serif text-[2.1rem] font-semibold leading-snug text-ink">측정에서 행동까지, 네 단계</h2>
          </div>
          <div className="mt-14 grid gap-12 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="num font-serif text-3xl font-semibold text-primary/30">{s.n}</div>
                <h3 className="mt-3 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{s.desc}</p>
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
              <Stethoscope size={15} /> 의료진을 위한
            </span>
            <h2 className="mt-4 font-serif text-[2rem] font-semibold leading-snug text-white">근거 중심 의료진 포털</h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/70">
              환자 위험순 모니터링, 표준등급, 기여 근거, 만관제 행정 지원까지.
              임상 판단을 돕는 정량 리포트를 제공합니다.
            </p>
            <Link href="/clinician/patients" className="group mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-ink transition hover:bg-white/90">
              의료진 화면 미리보기 <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
            <div className="mb-3 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-white/50">
              <span>환자 목록 예시</span><span>위험순</span>
            </div>
            <div className="space-y-2 text-sm">
              {[["김○○", "주의", "A2", "#d4691b"], ["이○○", "관찰 필요", "A2", "#c79100"], ["박○○", "양호", "A1", "#2e9e5b"]].map(([n, g, k, c]) => (
                <div key={n} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-2.5">
                  <span className="font-medium">{n}</span>
                  <span className="flex items-center gap-2 text-white/60">
                    <span className="num">신장 · {k}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: c as string }}>{g}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-white/40">
              <ShieldCheck size={13} /> 예시 화면 · 위험계층화는 진단을 대체하지 않습니다.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface px-10 py-20 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
          <span className="eyebrow">지금 시작하세요</span>
          <h2 className="mx-auto mt-4 max-w-xl font-serif text-[2.3rem] font-semibold leading-snug text-ink">
            측정 한 번으로 시작하는<br />만성질환 조기관리
          </h2>
          <div className="mt-9 flex justify-center gap-3">
            <Link href="/signup" className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-white transition hover:bg-primary-700">
              무료로 시작하기 <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/measure" className="inline-flex items-center gap-2 rounded-full border border-line px-7 py-3.5 font-semibold text-ink transition hover:border-ink/30">
              측정 체험
            </Link>
          </div>
        </div>
      </section>

      {/* 신뢰 스트립 (푸터 위) */}
      <div className="border-t border-line bg-surface/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 py-6 text-sm text-subtle">
          {["에스디씨웰케어(주)", "건강정보 암호화·분리 보관", "의료진 자문 콘텐츠", "의료 표준 기반 설계"].map((t, i) => (
            <span key={t} className="flex items-center gap-10">
              {i > 0 && <span className="text-line">/</span>}{t}
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
            <p className="mt-4 text-[13px] leading-relaxed text-subtle">에스디씨웰케어 주식회사<br />요화학분석기 기반 만성질환 관리 플랫폼</p>
          </div>
          {[
            { h: "제품", links: [["측정", "/measure"], ["대시보드", "/dashboard"], ["콘텐츠", "/contents"]] },
            { h: "파트너", links: [["의료진 포털", "/clinician/patients"], ["관리자", "/admin"]] },
            { h: "계정", links: [["로그인", "/login"], ["회원가입", "/signup"]] },
          ].map((col) => (
            <div key={col.h}>
              <div className="text-sm font-semibold text-ink">{col.h}</div>
              <ul className="mt-4 space-y-2.5 text-sm text-subtle">
                {col.links.map(([l, h]) => <li key={h}><Link href={h} className="transition-colors hover:text-ink">{l}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-6 py-6 text-center text-[12px] leading-relaxed text-subtle">
          본 서비스는 건강관리를 돕는 선별 정보를 제공하며 의료 진단을 대신하지 않습니다.
          위험계층화·등급 산출은 의료기기(SaMD) 인허가를 전제로 합니다. © 2026 SDC WellCare, Inc.
        </div>
      </footer>
    </div>
  );
}
