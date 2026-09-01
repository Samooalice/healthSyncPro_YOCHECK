// 관리자 — 감사로그 (9.5 / 보안 13장). PHI 접근·콘텐츠 게시·관리 행위 불변 기록.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { fmtDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

/** 액션 코드 → 배지 색. 라벨은 auditAction.* 카탈로그. */
const ACTION_COLOR: Record<string, string> = {
  view_phi: "#a6541b",
  view_admin: "#6b21a8",
  content_publish: "#127a6e",
  content_unpublish: "#888",
  clinician_signup: "#2E5A88",
  clinician_verify: "#a6541b",
  login: "#2E5A88",
  login_failed: "#C79100",
  login_blocked: "#b42318",
  account_switch: "#2E5A88",
};

function decodeName(buf: Uint8Array | null): string {
  if (!buf) return "—";
  try { return Buffer.from(buf).toString("utf8"); } catch { return "—"; }
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requireRole(["admin"]);
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const sp = await searchParams;
  const actionF = sp.action ?? "all";

  const where = actionF !== "all" ? { action: actionF } : {};
  const logs = await prisma.audit_log.findMany({ where, orderBy: { occurred_at: "desc" }, take: 200 });
  const actorIds = [...new Set(logs.map((l) => l.actor_id).filter((x): x is string => !!x))];
  const piis = actorIds.length ? await prisma.user_pii.findMany({ where: { user_id: { in: actorIds } } }) : [];
  const nameBy = new Map(piis.map((p) => [p.user_id, decodeName(p.name_enc as Uint8Array | null)]));

  const actions = await prisma.audit_log.groupBy({ by: ["action"], _count: { _all: true } });

  /** 알려진 코드면 번역하고, 새 코드면 원 코드를 그대로 노출한다(누락을 숨기지 않는다). */
  const actionLabel = (code: string) => (code in ACTION_COLOR ? t(`auditAction.${code}`) : code);

  return (
    <main className="mx-auto max-w-4xl px-5 py-6 font-sans">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E5A88]">{t("admin.statAudit")}</h1>
          <p className="text-xs text-gray-400">{t("audit.subtitle")}</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">← {t("audit.console")}</Link>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/admin/audit" className="rounded-full border px-3 py-1 text-xs transition"
          style={actionF === "all" ? { background: "#2E5A88", color: "#fff", borderColor: "#2E5A88" } : { color: "#6b7280", borderColor: "#e5e7eb" }}>{t("common.all")}</Link>
        {actions.map((a) => (
          <Link key={a.action} href={`/admin/audit?action=${a.action}`} className="rounded-full border px-3 py-1 text-xs transition"
            style={actionF === a.action ? { background: "#2E5A88", color: "#fff", borderColor: "#2E5A88" } : { color: "#6b7280", borderColor: "#e5e7eb" }}>
            {actionLabel(a.action)} ({a._count._all})
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">{t("audit.colTime")}</th>
              <th className="px-4 py-2">{t("audit.colActor")}</th>
              <th className="px-4 py-2">{t("audit.colAction")}</th>
              <th className="px-4 py-2">{t("audit.colTarget")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={String(l.id)} className="border-t border-gray-100">
                <td className="px-4 py-2 text-xs text-gray-400">{fmtDateTime(locale, l.occurred_at)}</td>
                <td className="px-4 py-2 text-gray-700">{l.actor_id ? nameBy.get(l.actor_id) ?? l.actor_id.slice(0, 8) : t("admin.system")}</td>
                <td className="px-4 py-2"><span className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: ACTION_COLOR[l.action] ?? "#888" }}>{actionLabel(l.action)}</span></td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{l.target ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">{t("audit.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-400">{t("audit.note")}</p>
    </main>
  );
}
