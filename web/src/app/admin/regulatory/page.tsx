// 관리자 — 규제 트랙 (9.5 / 규제 12장 / 초안집 문서1·4·5). SaMD vs 웰니스 분리·준비도·파일럿.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import {
  INTENDED_USE_KEYS, FEATURE_CLASSIFICATION, TRACK_COLOR, PREP_DOCS, PREP_STATUS_COLOR,
  PILOT_PHASES, PILOT_STATUS_COLOR,
} from "@/lib/regulatory";

export const dynamic = "force-dynamic";

export default async function RegulatoryPage() {
  const me = await requireRole(["admin"]);
  await audit(me.id, "view_admin", "regulatory");
  const t = await getTranslations();

  const [total, samd, wellness, byModel, contents, reviewed] = await Promise.all([
    prisma.risk_assessment.count(),
    prisma.risk_assessment.count({ where: { is_samd_output: true } }),
    prisma.risk_assessment.count({ where: { is_samd_output: false } }),
    prisma.risk_assessment.groupBy({ by: ["model_version"], _count: { _all: true } }),
    prisma.content.count(),
    prisma.content.count({ where: { status: "published" } }),
  ]);

  const prepDone = PREP_DOCS.filter((d) => d.status !== "todo").length;

  const kpis: [string, string | number, string][] = [
    [t("regulatory.kpiTotal"), total, "#2E5A88"],
    [t("regulatory.kpiSamd"), samd, "#a6541b"],
    [t("regulatory.kpiWellness"), wellness, "#127a6e"],
    [t("regulatory.kpiPublished"), `${reviewed}/${contents}`, "#6b21a8"],
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-7 font-sans">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E5A88]">{t("regulatory.title")}</h1>
          <p className="text-sm text-gray-500">{t("regulatory.subtitle")}</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-400">← {t("audit.console")}</Link>
      </header>

      {/* 의도된 사용 */}
      <section className="mb-5 rounded-2xl border border-gray-200 bg-[#f8fafc] p-5">
        <h2 className="mb-2 text-sm font-bold text-ink">{t("regulatory.intendedUseTitle")}</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {INTENDED_USE_KEYS.map((k) => (
            <div key={k}>
              <dt className="text-[11px] font-semibold text-gray-400">{t(`regulatory.intendedUseLabel.${k}`)}</dt>
              <dd className="text-gray-700">{t(`regulatory.intendedUse.${k}`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 트랙 분포 (런타임) */}
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(([l, v, c]) => (
          <div key={l} className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
            <div className="num text-2xl font-bold" style={{ color: c }}>{v}</div>
            <div className="text-xs text-gray-500">{l}</div>
          </div>
        ))}
      </section>

      {/* 기능별 트랙 분류 */}
      <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-ink">{t("regulatory.featureTitle")}</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-400">
            <tr>
              <th className="pb-1.5">{t("regulatory.colFeature")}</th>
              <th className="pb-1.5">{t("regulatory.colTrack")}</th>
              <th className="pb-1.5">{t("regulatory.colLikelihood")}</th>
              <th className="pb-1.5">{t("regulatory.colBasis")}</th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_CLASSIFICATION.map((f) => {
              const tc = TRACK_COLOR[f.track];
              return (
                <tr key={f.key} className="border-t border-gray-50">
                  <td className="py-2 text-gray-700">{t(`regulatory.feature.${f.key}.label`)}</td>
                  <td className="py-2"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: tc.color, background: tc.bg }}>{t(`regulatory.track.${f.track}`)}</span></td>
                  <td className="py-2 text-gray-600">{t(`regulatory.feature.${f.key}.likelihood`)}</td>
                  <td className="py-2 text-xs text-gray-500">{t(`regulatory.feature.${f.key}.basis`)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-gray-400">
          {t.rich("regulatory.featureNote", { code: (c) => <span className="font-mono">{c}</span> })}
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 준비 문서 체크리스트 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">{t("regulatory.prepTitle")}</h2>
            <span className="text-xs text-gray-400">{t("regulatory.prepStarted", { done: prepDone, total: PREP_DOCS.length })}</span>
          </div>
          <ul className="space-y-1.5">
            {PREP_DOCS.map((d) => (
              <li key={d.key} className="flex items-start justify-between gap-2 border-b border-gray-50 pb-1.5">
                <div>
                  <div className="text-sm text-gray-700">{t(`regulatory.prepDoc.${d.key}.doc`)}</div>
                  <div className="text-[11px] text-gray-400">{t(`regulatory.prepDoc.${d.key}.note`)}</div>
                </div>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: PREP_STATUS_COLOR[d.status] }}>{t(`regulatory.prepStatus.${d.status}`)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 임상검증·파일럿 단계 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">{t("regulatory.pilotTitle")}</h2>
          <ol className="space-y-3">
            {PILOT_PHASES.map((p, i) => {
              const color = PILOT_STATUS_COLOR[p.status];
              return (
                <li key={p.key} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: color }}>{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{t(`regulatory.pilotPhase.${p.key}.phase`)}</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color, background: color + "22" }}>{t(`regulatory.pilotStatus.${p.status}`)}</span>
                    </div>
                    <div className="text-xs text-gray-500">{t(`regulatory.pilotPhase.${p.key}.goal`)}</div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[11px] text-gray-400">{t("regulatory.modelNote", { n: byModel.length })}</p>
        </section>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-gray-400">
        {t("regulatory.disclaimer")}
      </p>
    </main>
  );
}
