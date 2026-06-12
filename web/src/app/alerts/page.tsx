// 알림 (9.1) — 인앱 알림 목록·읽음 처리. (Step 4 케어 폐루프)
import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { markAllRead } from "./actions";

export const dynamic = "force-dynamic";

const CAT: Record<string, { label: string; color: string }> = {
  result: { label: "결과", color: "#2E5A88" },
  risk: { label: "위험", color: "#D4691B" },
  recheck: { label: "재측정", color: "#C79100" },
  care: { label: "케어", color: "#1a8f84" },
  info: { label: "안내", color: "#6b7280" },
};

export default async function AlertsPage() {
  const me = await requireUser();
  const items = await prisma.notification.findMany({
    where: { user_id: me.id }, orderBy: { created_at: "desc" }, take: 50,
  });
  const unread = items.filter((i) => !i.read_at).length;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">알림 {unread > 0 && <span className="text-sm text-[#D4691B]">{unread}</span>}</h1>
        {unread > 0 && (
          <form action={markAllRead}>
            <button type="submit" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-body transition hover:text-ink">모두 읽음</button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
          아직 알림이 없어요.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const c = CAT[n.category] ?? CAT.info;
            const href = n.ref_type === "assessment" && n.ref_id ? `/result/${n.ref_id}` : null;
            const inner = (
              <div className="flex items-start gap-3 rounded-2xl border bg-white p-4"
                style={{ borderColor: n.read_at ? "#eef0f2" : c.color + "55", background: n.read_at ? "#fff" : "#fcfbf8" }}>
                <span className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: c.color }}>{c.label}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />}
                    <span className="text-sm font-semibold text-gray-800">{n.title}</span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{n.body}</p>
                  <div className="mt-1 text-[11px] text-gray-400">{new Date(n.created_at).toLocaleString("ko-KR", { hour12: false })}</div>
                </div>
              </div>
            );
            return href ? <Link key={n.id} href={href} className="block">{inner}</Link> : <div key={n.id}>{inner}</div>;
          })}
        </div>
      )}
      <p className="mt-4 text-center text-xs text-gray-400">※ 푸시·SMS·카카오 등 외부 채널은 발송 어댑터로 확장됩니다(제공자 키 필요).</p>
    </main>
  );
}
