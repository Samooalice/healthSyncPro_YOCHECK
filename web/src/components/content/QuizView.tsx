"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface Option { t: string; correct: boolean }
interface Question { q: string; options: Option[]; explain: string }

export default function QuizView({ questions }: { questions: Question[] }) {
  const t = useTranslations("contentView");
  const [picked, setPicked] = useState<Record<number, number>>({});
  const answered = Object.keys(picked).length;
  const correct = questions.filter((qq, i) => picked[i] != null && qq.options[picked[i]]?.correct).length;
  const done = answered === questions.length;

  return (
    <div>
      {done && (
        <div className="mb-4 rounded-2xl bg-[#eef5fb] p-4 text-center">
          <div className="text-sm text-gray-600">{t("quizResult")}</div>
          <div className="num text-2xl font-bold text-[#2E5A88]">{t("quizScore", { correct, total: questions.length })}</div>
        </div>
      )}
      <div className="space-y-5">
        {questions.map((qq, qi) => {
          const sel = picked[qi];
          const isAnswered = sel != null;
          return (
            <div key={qi} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-3 text-sm font-semibold text-gray-800"><span className="num text-[#2E5A88]">Q{qi + 1}.</span> {qq.q}</div>
              <div className="space-y-2">
                {qq.options.map((op, oi) => {
                  const chosen = sel === oi;
                  const reveal = isAnswered;
                  const good = op.correct;
                  let style = "border-gray-200 bg-white text-gray-700";
                  if (reveal && good) style = "border-[#2E9E5B] bg-green-50 text-[#1f7a45]";
                  else if (reveal && chosen && !good) style = "border-[#D4691B] bg-orange-50 text-[#b0540f]";
                  return (
                    <button key={oi} disabled={isAnswered}
                      onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition ${style} ${isAnswered ? "cursor-default" : "hover:border-[#2E5A88]/40"}`}>
                      <span>{op.t}</span>
                      {reveal && good && <Check size={16} className="text-[#2E9E5B]" />}
                      {reveal && chosen && !good && <X size={16} className="text-[#D4691B]" />}
                    </button>
                  );
                })}
              </div>
              {isAnswered && <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">💡 {qq.explain}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
