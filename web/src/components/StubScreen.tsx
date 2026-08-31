// 아직 미구현 화면의 구조 안내 스텁. 계획서상 들어갈 요소 + 구현 예정 Step 표기.
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function StubScreen({
  title,
  subtitle,
  items,
  step,
  back = "/",
}: {
  title: string;
  subtitle?: string;
  items: string[];
  step: string;
  back?: string;
}) {
  const t = await getTranslations("stub");
  return (
    <main className="mx-auto max-w-2xl px-5 py-6 font-sans">
      <header className="mb-4 flex items-center gap-2">
        <Link href={back} className="text-sm text-gray-400">←</Link>
        <h1 className="text-xl font-bold text-[#2E5A88]">{title}</h1>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{t("planned", { step })}</span>
      </header>
      {subtitle && <p className="mb-4 text-sm text-gray-500">{subtitle}</p>}

      <div className="rounded-xl border border-dashed border-gray-300 p-5">
        <div className="mb-2 text-sm font-semibold text-gray-700">{t("elements")}</div>
        <ul className="space-y-1.5 text-sm text-gray-600">
          {items.map((it) => (
            <li key={it} className="flex items-center gap-2">
              <span className="text-gray-300">▢</span> {it}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">{t("note", { step })}</p>
    </main>
  );
}
