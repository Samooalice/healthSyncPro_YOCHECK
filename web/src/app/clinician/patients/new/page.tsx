// 의료진 포털 — 환자 등록(계정 생성)
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import RegisterPatientForm from "./RegisterPatientForm";

export const dynamic = "force-dynamic";

export default async function NewPatientPage() {
  await requireRole(["clinician", "admin"]);
  const t = await getTranslations();
  return (
    <main className="mx-auto max-w-xl px-6 py-7 font-sans">
      <Link href="/clinician/patients" className="text-sm text-gray-400">← {t("nav.patients")}</Link>
      <h1 className="mt-3 text-2xl font-bold text-[#2E5A88]">{t("portal.registerTitle")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("portal.registerLead")}</p>
      <RegisterPatientForm />
    </main>
  );
}
