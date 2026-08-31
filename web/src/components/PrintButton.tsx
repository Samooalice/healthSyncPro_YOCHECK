"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";

export default function PrintButton() {
  const t = useTranslations("common");
  return (
    <button onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-gray-400 print:hidden">
      <Printer size={15} /> {t("printPdf")}
    </button>
  );
}
