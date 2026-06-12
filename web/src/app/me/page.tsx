// 마이페이지 — 프로필·동의 관리·기기·로그아웃. (계획서 9.1 마이페이지)
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { CONSENT_DEFS } from "@/lib/auth/consent";
import { logout } from "@/lib/auth/actions";
import { updateConsent } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_KO: Record<string, string> = { b2c: "사용자", clinician: "의료진", facility: "시설", admin: "관리자" };

export default async function MyPage() {
  const me = await requireUser();

  const [consentRows, devices] = await Promise.all([
    prisma.consent.findMany({ where: { user_id: me.id }, orderBy: { granted_at: "desc" } }),
    prisma.device.findMany({ where: { user_id: me.id }, orderBy: { registered_at: "desc" } }),
  ]);
  // 동의 유형별 최신 상태
  const latest = new Map<string, boolean>();
  for (const c of consentRows) if (!latest.has(c.consent_type)) latest.set(c.consent_type, c.granted);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-ink">마이페이지</h1>

      {/* 프로필 */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-subtle">프로필</h2>
        <dl className="space-y-3 text-sm">
          <Row label="이름" value={me.display_name ?? "-"} />
          <Row label="이메일" value={me.email ?? "-"} />
          <Row label="역할" value={ROLE_KO[me.account_type] ?? me.account_type} />
          <Row label="가명 ID" value={me.pseudo_id} mono />
        </dl>
      </section>

      {/* 동의 관리 */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-subtle">동의 관리</h2>
        <div className="space-y-3">
          {CONSENT_DEFS.map((c) => {
            const granted = latest.get(c.type) ?? c.required;
            return (
              <div key={c.type} className="flex items-start justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm font-medium text-ink">{c.label}</div>
                  <div className="mt-0.5 text-xs text-subtle">{c.desc}</div>
                </div>
                {c.required ? (
                  <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">동의함</span>
                ) : (
                  <form action={updateConsent} className="shrink-0">
                    <input type="hidden" name="type" value={c.type} />
                    <input type="hidden" name="granted" value={(!granted).toString()} />
                    <button type="submit"
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${granted ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-gray-100 text-subtle hover:bg-gray-200"}`}>
                      {granted ? "동의함 · 철회" : "동의 안 함 · 동의"}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-subtle">※ 동의 변경은 이력으로 기록됩니다. 민감정보(필수) 철회는 고객센터를 통해 처리됩니다.</p>
      </section>

      {/* 기기 */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-3 text-sm font-semibold text-subtle">등록 기기</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-subtle">등록된 기기가 없어요. 측정 화면에서 측정기를 연결할 수 있어요.</p>
        ) : (
          <ul className="space-y-1 text-sm text-body">
            {devices.map((d) => <li key={d.id}>• {d.device_model}</li>)}
          </ul>
        )}
      </section>

      {/* 로그아웃 */}
      <form action={logout} className="mt-6">
        <button type="submit" className="w-full rounded-lg border border-line bg-surface py-2.5 text-sm font-semibold text-risk-red transition hover:bg-risk-red/5">
          로그아웃
        </button>
      </form>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-subtle">{label}</dt>
      <dd className={`font-medium text-ink ${mono ? "num text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
