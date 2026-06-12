// 관리자 — 사용자·디바이스 관리 (9.5). 계정유형·상태·기기·측정 현황. 가명 기반.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TYPE_KO: Record<string, string> = { b2c: "이용자", facility: "시설", clinician: "의료진", admin: "관리자" };
const TYPE_COLOR: Record<string, string> = { b2c: "#2E5A88", facility: "#127a6e", clinician: "#a6541b", admin: "#6b21a8" };

function decodeName(buf: Uint8Array | null): string {
  if (!buf) return "—";
  try { return Buffer.from(buf).toString("utf8"); } catch { return "—"; }
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const me = await requireRole(["admin"]);
  const sp = await searchParams;
  const typeF = ["b2c", "facility", "clinician", "admin"].includes(sp.type ?? "") ? sp.type! : "all";
  await audit(me.id, "view_admin", "users");

  const users = await prisma.user_account.findMany({ orderBy: { created_at: "asc" } });
  const ids = users.map((u) => u.id);
  const [piis, devices, measCounts] = await Promise.all([
    prisma.user_pii.findMany({ where: { user_id: { in: ids } } }),
    prisma.device.groupBy({ by: ["user_id"], _count: { _all: true } }),
    prisma.measurement.groupBy({ by: ["user_id"], _count: { _all: true } }),
  ]);
  const nameBy = new Map(piis.map((p) => [p.user_id, decodeName(p.name_enc as Uint8Array | null)]));
  const devBy = new Map(devices.map((d) => [d.user_id, d._count._all]));
  const measBy = new Map(measCounts.map((m) => [m.user_id, m._count._all]));

  const rows = users.filter((u) => typeF === "all" || u.account_type === typeF);
  const tabs = [["all", "전체"], ["b2c", "이용자"], ["clinician", "의료진"], ["admin", "관리자"]] as [string, string][];

  return (
    <main className="mx-auto max-w-4xl px-5 py-6 font-sans">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E5A88]">사용자 · 디바이스</h1>
          <p className="text-xs text-gray-400">계정·기기·측정 현황 · 가명 기반</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">← 콘솔</Link>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map(([k, l]) => (
          <Link key={k} href={k === "all" ? "/admin/users" : `/admin/users?type=${k}`}
            className="rounded-full border px-3 py-1 text-xs transition"
            style={typeF === k ? { background: "#2E5A88", color: "#fff", borderColor: "#2E5A88" } : { color: "#6b7280", borderColor: "#e5e7eb" }}>
            {l}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">사용자</th><th className="px-4 py-2">유형</th>
              <th className="px-4 py-2">이메일</th><th className="px-4 py-2">상태</th>
              <th className="px-4 py-2">기기</th><th className="px-4 py-2">측정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-gray-800">{nameBy.get(u.id) ?? "—"}{u.is_super && <span className="ml-1 rounded bg-purple-100 px-1 text-[10px] font-bold text-purple-700">SUPER</span>}</div>
                  <div className="text-[11px] text-gray-400">{u.pseudo_id}</div>
                </td>
                <td className="px-4 py-2.5"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: TYPE_COLOR[u.account_type] ?? "#888" }}>{TYPE_KO[u.account_type] ?? u.account_type}</span></td>
                <td className="px-4 py-2.5 text-gray-600">{u.email ?? "—"}</td>
                <td className="px-4 py-2.5"><span className={u.status === "active" ? "text-emerald-600" : "text-gray-400"}>{u.status === "active" ? "활성" : u.status}</span></td>
                <td className="num px-4 py-2.5 text-gray-600">{devBy.get(u.id) ?? 0}</td>
                <td className="num px-4 py-2.5 text-gray-600">{measBy.get(u.id) ?? 0}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">해당 유형의 사용자가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-400">※ 실명·연락처는 secure 스키마에 암호화 저장되며, 콘솔은 가명·집계 중심으로 표시합니다. 계정 정지·동의 철회 등 변경 작업은 감사로그에 기록됩니다.</p>
    </main>
  );
}
