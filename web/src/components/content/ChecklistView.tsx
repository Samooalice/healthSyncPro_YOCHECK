"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

interface Mission { id: string; text: string; points: number; repeat: string }

export default function ChecklistView({ intro, missions }: { intro?: string; missions: Mission[] }) {
  const t = useTranslations("contentView");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const completed = missions.filter((m) => done[m.id]);
  const points = completed.reduce((s, m) => s + (m.points ?? 0), 0);

  return (
    <div>
      {intro && <p className="mb-4 text-sm leading-relaxed text-gray-700">{intro}</p>}
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#eef5fb] px-4 py-3">
        <span className="text-sm text-gray-600">{t.rich("doneToday", { done: completed.length, total: missions.length, b: (c) => <b className="num text-[#2E5A88]">{c}</b> })}</span>
        <span className="text-sm font-bold text-[#1a8f84]">+{points} P</span>
      </div>
      <div className="space-y-2">
        {missions.map((m) => {
          const on = !!done[m.id];
          return (
            <button key={m.id} onClick={() => setDone((d) => ({ ...d, [m.id]: !d[m.id] }))}
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition"
              style={{ borderColor: on ? "#1a8f84" : "#e5e7eb", background: on ? "#f0faf8" : "#fff" }}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2" style={{ borderColor: on ? "#1a8f84" : "#cbd5e1", background: on ? "#1a8f84" : "#fff" }}>
                {on && <Check size={14} className="text-white" />}
              </span>
              <span className={`flex-1 text-sm ${on ? "text-gray-400 line-through" : "text-gray-800"}`}>{m.text}</span>
              <span className="text-xs text-gray-400">{m.repeat} · {m.points}P</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-400">{t("checklistNote")}</p>
    </div>
  );
}
