// 관리자 — 사용자·디바이스 관리 (9.5). 계정유형·상태·기기·측정 현황. 가명 기반.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// 계정 유형 라벨은 accountType.* 카탈로그, 여기엔 색만 둔다.
const TYPE_COLOR: Record<string, string> = { b2c: "#2E5A88", facility: "#127a6e", clinician: "#a6541b", admin: "#6b21a8" };

function decodeName(buf: Uint8Array | null): string {
  if (!buf) return "—";
  try { return Buffer.from(buf).toString("utf8"); } catch { return "—"; }
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const me = await requireRole(["admin"]);
  const t = await getTranslations();
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
  const tabs = ["all", "b2c", "clinician", "admin"];
  const tabLabel = (k: string) => (k === "all" ? t("common.all") : t(`accountType.${k}`));

  return (
    <main className="mx-auto max-w-4xl px-5 py-6 font-sans">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E5A88]">{t("admin.area.users")}</h1>
          <p className="text-xs text-gray-400">{t("adminUsers.subtitle")}</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">← {t("audit.console")}</Link>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((k) => (
          <Link key={k} href={k === "all" ? "/admin/users" : `/admin/users?type=${k}`}
            className="rounded-full border px-3 py-1 text-xs transition"
            style={typeF === k ? { background: "#2E5A88", color: "#fff", borderColor: "#2E5A88" } : { color: "#6b7280", borderColor: "#e5e7eb" }}>
            {tabLabel(k)}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">{t("adminUsers.colUser")}</th><th className="px-4 py-2">{t("adminUsers.colType")}</th>
              <th className="px-4 py-2">{t("adminUsers.colEmail")}</th><th className="px-4 py-2">{t("curation.colStatus")}</th>
              <th className="px-4 py-2">{t("adminUsers.colDevice")}</th><th className="px-4 py-2">{t("nav.measure")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-gray-800">{nameBy.get(u.id) ?? "—"}{u.is_super && <span className="ml-1 rounded bg-purple-100 px-1 text-[10px] font-bold text-purple-700">SUPER</span>}</div>
                  <div className="text-[11px] text-gray-400">{u.pseudo_id}</div>
                </td>
                <td className="px-4 py-2.5"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: TYPE_COLOR[u.account_type] ?? "#888" }}>{u.account_type in TYPE_COLOR ? t(`accountType.${u.account_type}`) : u.account_type}</span></td>
                <td className="px-4 py-2.5 text-gray-600">{u.email ?? "—"}</td>
                <td className="px-4 py-2.5"><span className={u.status === "active" ? "text-emerald-600" : "text-gray-400"}>{u.status === "active" ? t("adminUsers.active") : u.status}</span></td>
                <td className="num px-4 py-2.5 text-gray-600">{devBy.get(u.id) ?? 0}</td>
                <td className="num px-4 py-2.5 text-gray-600">{measBy.get(u.id) ?? 0}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t("adminUsers.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-400">{t("adminUsers.note")}</p>
    </main>
  );
}
