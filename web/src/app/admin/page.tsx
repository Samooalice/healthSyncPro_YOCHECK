// 관리자 콘솔 (9.5) — 운영 현황 대시보드 + 관리 영역. 위험/질환/콘텐츠 분포·최근 활동.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { GRADE_TOKEN, DISEASE_KO } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

const ACTION_KO: Record<string, string> = {
  view_phi: "환자정보 열람", view_admin: "관리 콘솔 접근", content_publish: "콘텐츠 게시",
  content_unpublish: "콘텐츠 게시중단", clinician_signup: "의료진 가입신청", clinician_verify: "의료진 승인심사",
};
const GRADE_ORDER = ["very_high", "high", "moderate", "low"] as const;

function decodeName(buf: Uint8Array | null): string {
  if (!buf) return "시스템";
  try { return Buffer.from(buf).toString("utf8"); } catch { return "—"; }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminPage() {
  await requireRole(["admin"]);
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [users, b2c, clinicians, measurements, recentMeas, assessments, samd, contents, published, rules, auditCount, pendingClin, gradeGroups, diseaseGroups, contentGroups, recentLogs] = await Promise.all([
    prisma.user_account.count(),
    prisma.user_account.count({ where: { account_type: "b2c" } }),
    prisma.user_account.count({ where: { account_type: "clinician", status: "active" } }),
    prisma.measurement.count(),
    prisma.measurement.count({ where: { measured_at: { gte: weekAgo } } }),
    prisma.risk_assessment.count(),
    prisma.risk_assessment.count({ where: { is_samd_output: true } }),
    prisma.content.count(),
    prisma.content.count({ where: { status: "published" } }),
    prisma.content_curation_rule.count({ where: { active: true } }),
    prisma.audit_log.count(),
    prisma.user_account.count({ where: { account_type: "clinician", status: "pending" } }),
    prisma.risk_assessment.groupBy({ by: ["risk_grade"], _count: { _all: true } }),
    prisma.risk_assessment.groupBy({ by: ["disease"], _count: { _all: true } }),
    prisma.content.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.audit_log.findMany({ orderBy: { occurred_at: "desc" }, take: 6 }),
  ]);

  const gradeDist: Record<string, number> = {};
  for (const r of gradeGroups) gradeDist[r.risk_grade] = r._count._all;
  const gradeTotal = Object.values(gradeDist).reduce((a, b) => a + b, 0) || 1;
  const diseaseRanked = diseaseGroups.map((d) => [d.disease, d._count._all] as [string, number]).sort((a, b) => b[1] - a[1]);
  const maxDisease = diseaseRanked[0]?.[1] ?? 1;
  const contentDist: Record<string, number> = {};
  for (const c of contentGroups) if (c.status) contentDist[c.status] = c._count._all;

  const actorIds = [...new Set(recentLogs.map((l) => l.actor_id).filter((x): x is string => !!x))];
  const piis = actorIds.length ? await prisma.user_pii.findMany({ where: { user_id: { in: actorIds } } }) : [];
  const nameBy = new Map(piis.map((p) => [p.user_id, decodeName(p.name_enc as Uint8Array | null)]));

  const stats = [
    { label: "이용자", value: b2c, sub: `전체 ${users}` },
    { label: "활성 의료진", value: clinicians, sub: pendingClin > 0 ? `승인대기 ${pendingClin}` : "승인완료" },
    { label: "측정", value: measurements, sub: `최근7일 ${recentMeas}` },
    { label: "위험평가", value: assessments, sub: `SaMD ${samd}` },
    { label: "콘텐츠", value: `${published}/${contents}`, sub: "게시/전체" },
    { label: "감사로그", value: auditCount, sub: `규칙 ${rules}` },
  ];

  const areas = [
    { title: "의료진 승인", desc: pendingClin > 0 ? `가입 신청 ${pendingClin}건 승인 대기` : "의료진 자격검증·승인 관리", step: pendingClin > 0 ? `${pendingClin} 대기` : "관리", href: "/admin/clinicians", alert: pendingClin > 0 },
    { title: "사용자 · 디바이스", desc: "계정·기기·측정 현황", step: "관리", href: "/admin/users" },
    { title: "콘텐츠 · CMS", desc: "콘텐츠 작성·검수·게시 워크플로", step: "관리", href: "/admin/contents" },
    { title: "큐레이션 규칙", desc: "개인화 규칙·시뮬레이터", step: "보기", href: "/admin/curation" },
    { title: "규제 트랙", desc: "SaMD/웰니스 분리·표시·준비도", step: "보기", href: "/admin/regulatory" },
    { title: "감사로그", desc: "PHI 접근·콘텐츠 게시 등 불변 기록", step: "보기", href: "/admin/audit" },
    { title: "시스템 상태", desc: "의존성 헬스·보안 이벤트·관측성", step: "보기", href: "/admin/system" },
    { title: "의료진 포털", desc: "환자 모니터링·임상 리포트", step: "보기", href: "/clinician/patients" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-7 font-sans">
      <h1 className="mb-1 text-2xl font-bold text-[#2E5A88]">관리자 콘솔</h1>
      <p className="mb-5 text-sm text-gray-500">서비스 운영 현황과 규제·품질 지표를 한눈에 관리하세요.</p>

      {/* KPI */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-400">{s.label}</div>
            <div className="num mt-1 text-xl font-bold text-[#2E5A88]">{s.value}</div>
            <div className="text-[11px] text-gray-400">{s.sub}</div>
          </div>
        ))}
      </section>

      {/* 분포 3종 */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {/* 위험등급 분포 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">위험등급 분포</h2>
          <div className="flex h-3 overflow-hidden rounded-full">
            {GRADE_ORDER.map((gk) => { const n = gradeDist[gk] ?? 0; if (!n) return null; const g = GRADE_TOKEN[gk]; return <div key={gk} style={{ width: `${(n / gradeTotal) * 100}%`, background: g.color }} />; })}
          </div>
          <div className="mt-3 space-y-1 text-sm">
            {GRADE_ORDER.map((gk) => { const g = GRADE_TOKEN[gk]; return (
              <div key={gk} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} /><span className="text-gray-600">{g.label}</span></span>
                <span className="num text-gray-700">{gradeDist[gk] ?? 0}</span>
              </div>
            ); })}
          </div>
        </section>

        {/* 질환 분포 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">질환별 평가 분포</h2>
          {diseaseRanked.length === 0 ? <p className="text-sm text-gray-400">데이터 없음</p> : (
            <div className="space-y-2">
              {diseaseRanked.map(([d, n]) => (
                <div key={d}>
                  <div className="mb-0.5 flex justify-between text-sm"><span className="text-gray-600">{DISEASE_KO[d] ?? d}</span><span className="num text-gray-500">{n}</span></div>
                  <div className="h-2 rounded bg-gray-100"><div className="h-2 rounded bg-[#2E5A88]" style={{ width: `${(n / maxDisease) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 콘텐츠 워크플로 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">콘텐츠 워크플로</h2>
          <div className="space-y-1.5 text-sm">
            {[["draft", "초안", "#9ca3af"], ["medical_review", "의료검수", "#a6541b"], ["ra_review", "규제검수", "#6b21a8"], ["ready", "게시대기", "#2E5A88"], ["published", "게시됨", "#127a6e"]].map(([k, l, c]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} /><span className="text-gray-600">{l}</span></span>
                <span className="num text-gray-700">{contentDist[k] ?? 0}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 관리 영역 */}
        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">관리 영역</h2>
          <div className="space-y-2">
            {areas.map((a) => (
              <Link key={a.title} href={a.href}>
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition hover:border-[#2E5A88]/30">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{a.title}</div>
                    <div className="text-xs text-gray-500">{a.desc}</div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[11px]" style={a.alert ? { background: "#FCEBDD", color: "#d4691b", fontWeight: 700 } : { background: "#f3f4f6", color: "#6b7280" }}>{a.step}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 최근 활동 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">최근 활동</h2>
            <Link href="/admin/audit" className="text-xs text-gray-400">전체 →</Link>
          </div>
          <div className="space-y-1.5">
            {recentLogs.map((l) => (
              <div key={String(l.id)} className="rounded-xl border border-gray-100 bg-white p-2.5 text-xs">
                <div className="font-medium text-gray-700">{ACTION_KO[l.action] ?? l.action}</div>
                <div className="text-gray-400">{l.actor_id ? nameBy.get(l.actor_id) ?? "—" : "시스템"} · {new Date(l.occurred_at).toLocaleString("ko-KR", { hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            ))}
            {recentLogs.length === 0 && <p className="text-xs text-gray-400">기록 없음</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
