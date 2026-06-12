// 관리자 — 규제 트랙 (9.5 / 규제 12장 / 초안집 문서1·4·5). SaMD vs 웰니스 분리·준비도·파일럿.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import {
  INTENDED_USE, FEATURE_CLASSIFICATION, TRACK_LABEL, PREP_DOCS, PREP_STATUS_LABEL,
  PILOT_PHASES, PILOT_STATUS_LABEL,
} from "@/lib/regulatory";

export const dynamic = "force-dynamic";

export default async function RegulatoryPage() {
  const me = await requireRole(["admin"]);
  await audit(me.id, "view_admin", "regulatory");

  const [total, samd, wellness, byModel, contents, reviewed] = await Promise.all([
    prisma.risk_assessment.count(),
    prisma.risk_assessment.count({ where: { is_samd_output: true } }),
    prisma.risk_assessment.count({ where: { is_samd_output: false } }),
    prisma.risk_assessment.groupBy({ by: ["model_version"], _count: { _all: true } }),
    prisma.content.count(),
    prisma.content.count({ where: { status: "published" } }),
  ]);

  const prepDone = PREP_DOCS.filter((d) => d.status !== "todo").length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-7 font-sans">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E5A88]">규제 트랙 · 파일럿 준비</h1>
          <p className="text-sm text-gray-500">SaMD(의료기기 후보) · 웰니스 분리 · 인허가 준비도</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">← 콘솔</Link>
      </header>

      {/* 의도된 사용 */}
      <section className="mb-5 rounded-2xl border border-gray-200 bg-[#f8fafc] p-5">
        <h2 className="mb-2 text-sm font-bold text-ink">의도된 사용 (Intended Use)</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {[["사용 목적", INTENDED_USE.purpose], ["사용 대상", INTENDED_USE.users], ["사용 환경", INTENDED_USE.environment], ["사용 제외", INTENDED_USE.notIntended]].map(([l, v]) => (
            <div key={l}><dt className="text-[11px] font-semibold text-gray-400">{l}</dt><dd className="text-gray-700">{v}</dd></div>
          ))}
        </dl>
      </section>

      {/* 트랙 분포 (런타임) */}
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["전체 위험평가", total, "#2E5A88"], ["SaMD 후보 출력", samd, "#a6541b"], ["웰니스 출력", wellness, "#127a6e"], ["게시 콘텐츠", `${reviewed}/${contents}`, "#6b21a8"]].map(([l, v, c]) => (
          <div key={l as string} className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
            <div className="num text-2xl font-bold" style={{ color: c as string }}>{v as string | number}</div>
            <div className="text-xs text-gray-500">{l as string}</div>
          </div>
        ))}
      </section>

      {/* 기능별 트랙 분류 */}
      <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-ink">기능별 트랙 분류 (SaMD 후보 식별)</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-400">
            <tr><th className="pb-1.5">기능</th><th className="pb-1.5">트랙</th><th className="pb-1.5">SaMD 가능성</th><th className="pb-1.5">근거(가정)</th></tr>
          </thead>
          <tbody>
            {FEATURE_CLASSIFICATION.map((f) => {
              const t = TRACK_LABEL[f.track];
              return (
                <tr key={f.feature} className="border-t border-gray-50">
                  <td className="py-2 text-gray-700">{f.feature}</td>
                  <td className="py-2"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: t.color, background: t.bg }}>{t.label}</span></td>
                  <td className="py-2 text-gray-600">{f.likelihood}</td>
                  <td className="py-2 text-xs text-gray-500">{f.basis}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-gray-400">※ 분류는 가정이며, 실제 SaMD 해당성·등급은 식약처 사전상담에서 확정합니다. 트랙은 <span className="font-mono">is_samd_output</span> 플래그로 분리·로깅됩니다.</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 준비 문서 체크리스트 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">인허가 준비 문서</h2>
            <span className="text-xs text-gray-400">{prepDone}/{PREP_DOCS.length} 착수</span>
          </div>
          <ul className="space-y-1.5">
            {PREP_DOCS.map((d) => {
              const s = PREP_STATUS_LABEL[d.status];
              return (
                <li key={d.doc} className="flex items-start justify-between gap-2 border-b border-gray-50 pb-1.5">
                  <div>
                    <div className="text-sm text-gray-700">{d.doc}</div>
                    <div className="text-[11px] text-gray-400">{d.note}</div>
                  </div>
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: s.color }}>{s.label}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 임상검증·파일럿 단계 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">임상 검증 · 파일럿 단계</h2>
          <ol className="space-y-3">
            {PILOT_PHASES.map((p, i) => {
              const s = PILOT_STATUS_LABEL[p.status];
              return (
                <li key={p.phase} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: s.color }}>{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-800">{p.phase}</span><span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: s.color, background: s.color + "22" }}>{s.label}</span></div>
                    <div className="text-xs text-gray-500">{p.goal}</div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[11px] text-gray-400">모델 버전 {byModel.length}종 추적 중 · 변경관리 SOP로 배포 게이트 적용(가정).</p>
        </section>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-gray-400">
        ※ 현재 서비스는 건강관리(웰니스) 트랙으로 운영하며, 위험계층화·등급 산출은 의료기기(SaMD) 인허가를 전제로 한 후보 출력입니다. 출시 범위·시점은 규제 검토·사전상담 결과에 따릅니다.
      </p>
    </main>
  );
}
