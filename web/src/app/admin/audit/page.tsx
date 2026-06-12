// 관리자 — 감사로그 (9.5 / 보안 13장). PHI 접근·콘텐츠 게시·관리 행위 불변 기록.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const ACTION_KO: Record<string, { label: string; color: string }> = {
  view_phi: { label: "환자정보 열람", color: "#a6541b" },
  view_admin: { label: "관리 콘솔 접근", color: "#6b21a8" },
  content_publish: { label: "콘텐츠 게시", color: "#127a6e" },
  content_unpublish: { label: "콘텐츠 게시중단", color: "#888" },
  clinician_signup: { label: "의료진 가입신청", color: "#2E5A88" },
  clinician_verify: { label: "의료진 승인심사", color: "#a6541b" },
  login: { label: "로그인", color: "#2E5A88" },
  login_failed: { label: "로그인 실패", color: "#C79100" },
  login_blocked: { label: "로그인 차단(레이트리밋)", color: "#b42318" },
  account_switch: { label: "계정 전환", color: "#2E5A88" },
};

function decodeName(buf: Uint8Array | null): string {
  if (!buf) return "—";
  try { return Buffer.from(buf).toString("utf8"); } catch { return "—"; }
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const actionF = sp.action ?? "all";

  const where = actionF !== "all" ? { action: actionF } : {};
  const logs = await prisma.audit_log.findMany({ where, orderBy: { occurred_at: "desc" }, take: 200 });
  const actorIds = [...new Set(logs.map((l) => l.actor_id).filter((x): x is string => !!x))];
  const piis = actorIds.length ? await prisma.user_pii.findMany({ where: { user_id: { in: actorIds } } }) : [];
  const nameBy = new Map(piis.map((p) => [p.user_id, decodeName(p.name_enc as Uint8Array | null)]));

  const actions = await prisma.audit_log.groupBy({ by: ["action"], _count: { _all: true } });

  return (
    <main className="mx-auto max-w-4xl px-5 py-6 font-sans">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E5A88]">감사로그</h1>
          <p className="text-xs text-gray-400">PHI 접근·콘텐츠 게시·관리 행위 기록 (최근 200건)</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">← 콘솔</Link>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/admin/audit" className="rounded-full border px-3 py-1 text-xs transition"
          style={actionF === "all" ? { background: "#2E5A88", color: "#fff", borderColor: "#2E5A88" } : { color: "#6b7280", borderColor: "#e5e7eb" }}>전체</Link>
        {actions.map((a) => (
          <Link key={a.action} href={`/admin/audit?action=${a.action}`} className="rounded-full border px-3 py-1 text-xs transition"
            style={actionF === a.action ? { background: "#2E5A88", color: "#fff", borderColor: "#2E5A88" } : { color: "#6b7280", borderColor: "#e5e7eb" }}>
            {ACTION_KO[a.action]?.label ?? a.action} ({a._count._all})
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr><th className="px-4 py-2">시각</th><th className="px-4 py-2">행위자</th><th className="px-4 py-2">행위</th><th className="px-4 py-2">대상</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const a = ACTION_KO[l.action];
              return (
                <tr key={String(l.id)} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-xs text-gray-400">{new Date(l.occurred_at).toLocaleString("ko-KR", { hour12: false })}</td>
                  <td className="px-4 py-2 text-gray-700">{l.actor_id ? nameBy.get(l.actor_id) ?? l.actor_id.slice(0, 8) : "시스템"}</td>
                  <td className="px-4 py-2"><span className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: a?.color ?? "#888" }}>{a?.label ?? l.action}</span></td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{l.target ?? "—"}</td>
                </tr>
              );
            })}
            {logs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">기록이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-400">※ 감사로그는 추가 전용(append-only)으로 운영하며, 운영 단계에서는 변조 방지·보존기간 정책을 적용합니다.</p>
    </main>
  );
}
