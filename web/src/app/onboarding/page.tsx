// 온보딩 — 가입 직후 환영·검사결과 읽는 법(C-ONB-01)·시작 안내. (기기 등록은 마이에서)
import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { Droplet, LineChart, ShieldCheck, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const STEPS = [
  { Icon: Droplet, title: "측정", desc: "측정기와 연결하거나 데모로 소변 11종을 측정해요." },
  { Icon: LineChart, title: "결과 읽기", desc: "초록(양호)·노랑(관찰)·주황(주의)·빨강(높음) 색과 해설을 함께 봐요." },
  { Icon: ShieldCheck, title: "안전 안내", desc: "선별 정보예요. 의료 진단을 대신하지 않으며, 우려되면 의료진과 상담하세요." },
];

export default async function OnboardingPage() {
  const me = await requireUser();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="text-center">
        <span className="eyebrow">환영합니다</span>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-ink">{me.display_name ?? ""} 님, 시작해요</h1>
        <p className="mt-2 text-body">측정으로 건강 관리를 시작하는 방법을 간단히 안내해 드릴게요.</p>
      </div>

      <div className="mt-10 space-y-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <s.Icon size={20} strokeWidth={1.75} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="num text-xs font-bold text-subtle">0{i + 1}</span>
                <h3 className="font-bold text-ink">{s.title}</h3>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-body">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link href="/measure" className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-white transition hover:bg-primary-700">
          첫 측정 시작하기 <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link href="/dashboard" className="inline-flex items-center rounded-full border border-line bg-surface px-7 py-3.5 font-semibold text-ink transition hover:border-ink/30">
          대시보드로
        </Link>
      </div>
    </main>
  );
}
