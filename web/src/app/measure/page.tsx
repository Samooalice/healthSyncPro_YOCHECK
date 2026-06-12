"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BLE, parsePacket, buildPacket, yocheckToInternal,
} from "@/lib/measurement/yocheck";

// 데모 시나리오 (sdc_deploy ble_test.html 과 동일 포맷)
const SCENARIOS: Record<string, Record<string, string>> = {
  normal: { blood: "음성", bilirubin: "음성", urobilinogen: "0.2", ketones: "음성", protein: "음성", nitrite: "음성", glucose: "음성", ph: "6.5", specific_gravity: "1.025", leukocyte: "음성", vitamin_c: "음성" },
  uti: { blood: "미량", bilirubin: "음성", urobilinogen: "0.2", ketones: "음성", protein: "1+", nitrite: "양성", glucose: "음성", ph: "6.8", specific_gravity: "1.030", leukocyte: "2+", vitamin_c: "음성" },
  diabetes: { blood: "음성", bilirubin: "음성", urobilinogen: "0.2", ketones: "2+", protein: "음성", nitrite: "음성", glucose: "3+", ph: "5.5", specific_gravity: "1.035", leukocyte: "음성", vitamin_c: "음성" },
  kidney: { blood: "1+", bilirubin: "음성", urobilinogen: "0.2", ketones: "음성", protein: "2+", nitrite: "음성", glucose: "음성", ph: "7.0", specific_gravity: "1.020", leukocyte: "음성", vitamin_c: "음성" },
};
const SCENARIO_LABEL: Record<string, string> = {
  normal: "정상 (모든 항목 정상)", uti: "요로감염 의심 (백혈구·아질산염)",
  diabetes: "당뇨 의심 (포도당·케톤)", kidney: "신장 의심 (단백뇨·잠혈)",
};

export default function MeasurePage() {
  const router = useRouter();
  const [status, setStatus] = useState<{ text: string; tone: "idle" | "busy" | "ok" | "err" }>({ text: "대기중", tone: "idle" });
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [scenario, setScenario] = useState("kidney");
  const [busy, setBusy] = useState(false);

  const dev = useRef<any>(null);
  const notifyChar = useRef<any>(null);
  const writeChar = useRef<any>(null);
  const rxBuffer = useRef("");

  function log(msg: string) {
    const t = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    setLogs((l) => [...l.slice(-80), `[${t}] ${msg}`]);
  }

  async function onConnect() {
    const bt = (navigator as any).bluetooth;
    if (!bt) { setStatus({ text: "미지원 브라우저", tone: "err" }); log("Web Bluetooth 미지원 — Chrome/Edge 필요"); return; }
    try {
      setStatus({ text: "기기 검색중…", tone: "busy" });
      const device = await bt.requestDevice({
        filters: BLE.NAME_KEYWORDS.map((k) => ({ namePrefix: k })),
        optionalServices: [BLE.SERVICE_UUID],
      });
      dev.current = device;
      log(`선택 기기: ${device.name ?? "(이름없음)"}`);
      device.addEventListener("gattserverdisconnected", () => { setConnected(false); setStatus({ text: "연결 끊김", tone: "idle" }); });
      setStatus({ text: "연결중…", tone: "busy" });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE.SERVICE_UUID);
      notifyChar.current = await service.getCharacteristic(BLE.NOTIFY_UUID);
      await notifyChar.current.startNotifications();
      notifyChar.current.addEventListener("characteristicvaluechanged", onNotify);
      writeChar.current = await service.getCharacteristic(BLE.WRITE_UUID);
      setConnected(true);
      setStatus({ text: "연결됨", tone: "ok" });
      log("연결·Notify 구독 완료 — 측정 시작 가능");
    } catch (e) {
      log("연결 실패: " + (e as Error).message);
      setStatus({ text: "연결 실패", tone: "err" });
    }
  }

  function hexToBytes(hex: string) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  async function onMeasure() {
    if (!writeChar.current) return;
    try {
      rxBuffer.current = "";
      setStatus({ text: "측정중…", tone: "busy" });
      const bytes = hexToBytes(BLE.COMMAND_TS_HEX);
      log("TX → %TS (측정 명령)");
      if (writeChar.current.writeValueWithoutResponse) await writeChar.current.writeValueWithoutResponse(bytes);
      else await writeChar.current.writeValue(bytes);
      log("명령 전송 — 응답 대기중…");
    } catch (e) { log("측정 전송 실패: " + (e as Error).message); setStatus({ text: "전송 실패", tone: "err" }); }
  }

  function onNotify(event: any) {
    const chunk = new TextDecoder().decode(event.target.value).replace(/\n/g, "");
    rxBuffer.current += chunk;
    if (rxBuffer.current.includes("ERR")) { log("기기 ERR — 스트립 없음. 삽입 후 재측정"); setStatus({ text: "스트립 오류", tone: "err" }); return; }
    if (rxBuffer.current.includes(BLE.DONE_MARKER)) { log("수신 완료 — 결과 분석"); handlePacket(rxBuffer.current, dev.current?.name ?? "검사기"); }
  }

  function onDemo() {
    const packet = buildPacket(SCENARIOS[scenario]);
    log(`데모 측정 (${scenario})`);
    handlePacket(packet, "데모 검사기");
  }

  async function handlePacket(buf: string, deviceName: string) {
    const values = yocheckToInternal(parsePacket(buf));
    setBusy(true);
    setStatus({ text: "분석중…", tone: "busy" });
    try {
      const post = await fetch("/api/v1/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values, source: "analyzer", device: deviceName }),
      });
      if (!post.ok) throw new Error((await post.json()).detail ?? "측정 처리 실패");
      const { assessment_id } = await post.json();
      setStatus({ text: "측정 완료", tone: "ok" });
      log("분석 완료 — 결과 화면으로 이동");
      router.push(`/result/${assessment_id}`);
    } catch (e) {
      log("분석 실패: " + (e as Error).message);
      setStatus({ text: "분석 실패", tone: "err" });
      setBusy(false);
    }
  }

  const toneColor = { idle: "#6b7280", busy: "#9a7400", ok: "#1a8f84", err: "#c0392b" }[status.tone];

  return (
    <main className="mx-auto max-w-2xl px-5 py-6 font-sans">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E5A88]">소변검사 측정</h1>
          <p className="mt-1 text-sm text-gray-500">요화학 측정기와 연결해 11종을 측정합니다.</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: toneColor }}>{status.text}</span>
      </header>

      {/* 검사기 연결 */}
      <section className="rounded-xl border border-gray-200 p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">검사기 연결 (BLE)</h2>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onConnect} disabled={connected || busy}
            className="rounded-lg bg-[#2E5A88] py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            기기 검색 &amp; 연결
          </button>
          <button onClick={onMeasure} disabled={!connected || busy}
            className="rounded-lg border border-[#2E5A88] py-2.5 text-sm font-semibold text-[#2E5A88] disabled:opacity-40">
            측정 시작
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">YOCHECK / PhotoMT / OptoSta 기기. Chrome·Edge에서만 동작(Web Bluetooth).</p>
      </section>

      {/* 데모 측정 */}
      <section className="mt-4 rounded-xl border-l-4 border-[#E8B500] bg-amber-50/40 p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">데모 측정 (스트립 없이)</h2>
        <div className="flex gap-2">
          <select value={scenario} onChange={(e) => setScenario(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-2 py-2 text-sm">
            {Object.keys(SCENARIOS).map((k) => <option key={k} value={k}>{SCENARIO_LABEL[k]}</option>)}
          </select>
          <button onClick={onDemo} disabled={busy}
            className="rounded-lg bg-[#E8B500] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            데모 측정 실행
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">측정기 응답 패킷을 합성해 동일 파싱·분석 엔진으로 결과를 표시합니다.</p>
      </section>

      {logs.length > 0 && (
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-[#0b1220] p-3 text-[11px] leading-relaxed text-[#a3e635]">
          {logs.join("\n")}
        </pre>
      )}
    </main>
  );
}
