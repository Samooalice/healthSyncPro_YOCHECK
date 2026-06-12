// 관리자 — 의료진 승인 (자격검증 게이트). 가입 신청(pending) 승인/반려.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { approveClinician, rejectClinician } from "./actions";

export const dynamic = "force-dynamic";

const LICENSE_KO: Record<string, string> = { doctor: "의사", nurse: "간호사", medtech: "임상병리사" };
const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "승인 대기", color: "#a6541b", bg: "#FCEBDD" },
  active: { label: "승인됨", color: "#127a6e", bg: "#E1F3EF" },
  rejected: { label: "반려됨", color: "#b42318", bg: "#FEE4E2" },
};

function decodeName(buf: Uint8Array | null): string {
  if (!buf) return "—";
  try { return Buffer.from(buf).toString("utf8"); } catch { return "—"; }
}
function maskLicense(no: string | null): string {
  if (!no) return "—";
  return no.length <= 4 ? no : no.slice(0, 2) + "•".repeat(Math.max(1, no.length - 4)) + no.slice(-2);
}

export default async function AdminCliniciansPage() {
  const me = await requireRole(["admin"]);
  await audit(me.id, "view_admin", "clinicians");

  const clinicians = await prisma.user_account.findMany({ where: { account_type: "clinician" }, orderBy: { created_at: "desc" } });
  const ids = clinicians.map((c) => c.id);
  const [profiles, piis] = await Promise.all([
    prisma.clinician_profile.findMany({ where: { user_id: { in: ids } } }),
    prisma.user_pii.findMany({ where: { user_id: { in: ids } } }),
  ]);
  const profBy = new Map(profiles.map((p) => [p.user_id, p]));
  const nameBy = new Map(piis.map((p) => [p.user_id, decodeName(p.name_enc as Uint8Array | null)]));

  // 승인 대기 우선 정렬
  const rank: Record<string, number> = { pending: 0, active: 1, rejected: 2 };
  const rows = clinicians.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  const pendingCount = clinicians.filter((c) => c.status === "pending").length;

  return (
    <main className="mx-auto max-w-4xl px-5 py-6 font-sans">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E5A88]">의료진 승인</h1>
          <p className="text-xs text-gray-400">면허 확인 후 승인하면 포털 로그인이 활성화됩니다 · 승인 대기 {pendingCount}건</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">← 콘솔</Link>
      </header>

      <div className="space-y-3">
        {rows.map((c) => {
          const p = profBy.get(c.id);
          const s = STATUS_BADGE[c.status] ?? STATUS_BADGE.pending;
          return (
            <div key={c.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{nameBy.get(c.id) ?? "—"}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: s.color, background: s.bg }}>{s.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">{c.email}</div>
                </div>
                <span className="text-[11px] text-gray-400">{new Date(c.created_at).toLocaleDateString("ko-KR")}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                {([["면허 종류", p ? LICENSE_KO[p.license_type] ?? p.license_type : "—"], ["면허번호", maskLicense(p?.license_no ?? null)], ["소속", p?.organization ?? "—"], ["진료과", p?.department ?? "—"]] as [string, string][]).map(([l, v]) => (
                  <div key={l}><div className="text-[11px] text-gray-400">{l}</div><div className="text-gray-700">{v}</div></div>
                ))}
              </div>

              {c.status === "rejected" && p?.reject_reason && <p className="mt-2 text-xs text-red-600">반려 사유: {p.reject_reason}</p>}

              {c.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
                  <form action={approveClinician}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700">승인</button>
                  </form>
                  <form action={rejectClinician} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="reason" placeholder="반려 사유(선택)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-400" />
                    <button className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50">반려</button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400">의료진 가입 신청이 없습니다.</p>}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-gray-400">
        ※ 면허번호는 마스킹 표시되며, 승인/반려는 감사로그에 기록됩니다. 운영 단계에서는 면허 진위확인(외부 검증) 절차를 연동합니다.
      </p>
    </main>
  );
}
