// 의료진 포털 — 환자 대리 측정. 측정값은 선택한 환자에게 귀속된다.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { canAccessPatient } from "@/lib/auth/careTeam";
import MeasureClient from "@/components/MeasureClient";

export const dynamic = "force-dynamic";

function decodeName(buf: Uint8Array | null | undefined, fallback: string): string {
  if (!buf) return fallback;
  try { return Buffer.from(buf).toString("utf8"); } catch { return fallback; }
}

export default async function PatientMeasurePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole(["clinician", "admin"]);
  const { id } = await params;
  if (!(await canAccessPatient(me, id))) notFound();
  const user = await prisma.user_account.findUnique({ where: { id }, include: { user_pii: true } });
  if (!user || user.account_type !== "b2c") notFound();

  const t = await getTranslations("patient");
  const name = decodeName(user.user_pii?.name_enc as Uint8Array | null | undefined, user.display_name ?? t("noName"));

  return <MeasureClient patient={{ id: user.id, name, pseudoId: user.pseudo_id }} />;
}
