"use client";

// 건강검진(PHR, 나의건강기록 JSON) 업로드 — 결과 보고서에서 요화학+PHR 종합 보고서로 갱신.
// 여러 파일(검진/진료/투약/예방접종 분리본) 또는 통합 JSON 모두 선택 가능. 기존 PHR에 누적 병합.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** 현재 보고 있는 측정 id — 업로드 후 이 측정을 PHR 결합으로 재분석한다. */
  measurementId?: string;
  /** 이미 PHR이 연동된 경우 '추가/갱신' 톤의 작은 버튼으로 표시 */
  compact?: boolean;
}

export default function PhrUpload({ measurementId, compact = false }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "err">("idle");
  const [msg, setMsg] = useState<string>("");

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setStatus("busy");
    setMsg(`파일 ${files.length}개 분석 중…`);
    try {
      // 각 파일을 JSON 으로 파싱 → datasets 배열로 전송(서버에서 추출·병합·중복제거)
      const datasets: unknown[] = [];
      const bad: string[] = [];
      for (const f of files) {
        try {
          datasets.push(JSON.parse(await f.text()));
        } catch {
          bad.push(f.name);
        }
      }
      if (datasets.length === 0) throw new Error("JSON 파일이 아니거나 형식이 올바르지 않아요.");

      const res = await fetch("/api/v1/phr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ datasets, measurement_id: measurementId }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data?.detail ?? `업로드 실패 (HTTP ${res.status}). 서버 로그를 확인하세요.`);

      const addNote = data.is_merge ? `기존에 ${data.resource_added}건 추가` : `${data.resource_total}건 연동`;
      const badNote = bad.length ? ` (오류 파일 ${bad.length}개 제외)` : "";
      setMsg(`건강검진 데이터 반영 — ${addNote} · 검진 ${data.checkups}회${badNote}`);
      if (data.assessment_id) router.push(`/result/${data.assessment_id}`);
      else router.refresh();
    } catch (err) {
      setStatus("err");
      setMsg((err as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const busy = status === "busy";

  return (
    <div>
      <input ref={fileRef} type="file" accept="application/json,.json" multiple onChange={onFiles} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className={
          compact
            ? "rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            : "w-full rounded-xl bg-[#1a8f84] py-2.5 text-sm font-semibold text-white transition hover:bg-[#157a70] disabled:opacity-50"
        }
      >
        {busy ? "처리 중…" : compact ? "건강검진 추가/갱신" : "건강검진(나의건강기록) 연동하기"}
      </button>
      {msg && (
        <p className={`mt-2 text-xs ${status === "err" ? "text-risk-red" : "text-gray-500"}`}>{msg}</p>
      )}
      {!compact && status !== "err" && (
        <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
          ※ 나의건강기록에서 내려받은 JSON 파일(phr_…json)을 올리면 요화학 결과와 합쳐 종합 보고서가 만들어져요. <b>여러 파일을 한 번에</b> 선택할 수 있고, 다시 올리면 기존 기록에 <b>누적</b>돼요.
        </p>
      )}
    </div>
  );
}
