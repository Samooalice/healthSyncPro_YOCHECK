"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  BLE, parsePacket, buildPacket, yocheckToInternal,
} from "@/lib/measurement/yocheck";
import { fmtTime } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

// 데모 시나리오 (sdc_deploy ble_test.html 과 동일 포맷)
// i18n:skip-start — 아래 값들은 측정기 프로토콜 토큰이라 번역 대상이 아니다.
const SCENARIOS: Record<string, Record<string, string>> = {
  normal: { blood: "음성", bilirubin: "음성", urobilinogen: "0.2", ketones: "음성", protein: "음성", nitrite: "음성", glucose: "음성", ph: "6.5", specific_gravity: "1.025", leukocyte: "음성", vitamin_c: "음성" },
  uti: { blood: "미량", bilirubin: "음성", urobilinogen: "0.2", ketones: "음성", protein: "1+", nitrite: "양성", glucose: "음성", ph: "6.8", specific_gravity: "1.030", leukocyte: "2+", vitamin_c: "음성" },
  diabetes: { blood: "음성", bilirubin: "음성", urobilinogen: "0.2", ketones: "2+", protein: "음성", nitrite: "음성", glucose: "3+", ph: "5.5", specific_gravity: "1.035", leukocyte: "음성", vitamin_c: "음성" },
  kidney: { blood: "1+", bilirubin: "음성", urobilinogen: "0.2", ketones: "음성", protein: "2+", nitrite: "음성", glucose: "음성", ph: "7.0", specific_gravity: "1.020", leukocyte: "음성", vitamin_c: "음성" },
};
// i18n:skip-end
// 시나리오 설명 문구는 measure.scenario.* 카탈로그

// 측정 화면 공용 컴포넌트.
//  - 본인 측정(/measure): patient 없음 → 결과 화면으로 이동
//  - 의료진 대리 측정(/clinician/patients/[id]/measure): patient 지정 → 측정값은 해당 환자에게 귀속, 환자 상세로 복귀
export interface MeasurePatient { id: string; name: string; pseudoId: string }

export default function MeasureClient({ patient }: { patient?: MeasurePatient }) {
  const router = useRouter();
  const t = useTranslations("measure");
  const locale = useLocale() as Locale;
  // 상태는 메시지 키로 들고 다니다가 그릴 때 번역한다(언어 전환 시 함께 바뀌도록).
  const [status, setStatus] = useState<{ key: string; tone: "idle" | "busy" | "ok" | "err" }>({ key: "idle", tone: "idle" });
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [scenario, setScenario] = useState("kidney");
  const [busy, setBusy] = useState(false);

  const dev = useRef<any>(null);
  const notifyChar = useRef<any>(null);
  const writeChar = useRef<any>(null);
  const rxBuffer = useRef("");

  function log(msg: string) {
    const stamp = fmtTime(locale, new Date());
    setLogs((l) => [...l.slice(-80), `[${stamp}] ${msg}`]);
  }

  async function onConnect() {
    const bt = (navigator as any).bluetooth;
    if (!bt) { setStatus({ key: "unsupported", tone: "err" }); log(t("log.noBluetooth")); return; }
    try {
      setStatus({ key: "scanning", tone: "busy" });
      const device = await bt.requestDevice({
        filters: BLE.NAME_KEYWORDS.map((k) => ({ namePrefix: k })),
        optionalServices: [BLE.SERVICE_UUID],
      });
      dev.current = device;
      log(t("log.selectedDevice", { name: device.name ?? t("unnamedDevice") }));
      device.addEventListener("gattserverdisconnected", () => { setConnected(false); setStatus({ key: "disconnected", tone: "idle" }); });
      setStatus({ key: "connecting", tone: "busy" });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE.SERVICE_UUID);
      notifyChar.current = await service.getCharacteristic(BLE.NOTIFY_UUID);
      await notifyChar.current.startNotifications();
      notifyChar.current.addEventListener("characteristicvaluechanged", onNotify);
      writeChar.current = await service.getCharacteristic(BLE.WRITE_UUID);
      setConnected(true);
      setStatus({ key: "connected", tone: "ok" });
      log(t("log.subscribed"));
    } catch (e) {
      log(t("log.connectFailed", { message: (e as Error).message }));
      setStatus({ key: "connectFailed", tone: "err" });
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
      setStatus({ key: "measuring", tone: "busy" });
      const bytes = hexToBytes(BLE.COMMAND_TS_HEX);
      log(t("log.txCommand"));
      if (writeChar.current.writeValueWithoutResponse) await writeChar.current.writeValueWithoutResponse(bytes);
      else await writeChar.current.writeValue(bytes);
      log(t("log.awaitingResponse"));
    } catch (e) { log(t("log.sendFailed", { message: (e as Error).message })); setStatus({ key: "sendFailed", tone: "err" }); }
  }

  function onNotify(event: any) {
    const chunk = new TextDecoder().decode(event.target.value).replace(/\n/g, "");
    rxBuffer.current += chunk;
    if (rxBuffer.current.includes("ERR")) { log(t("log.stripError")); setStatus({ key: "stripError", tone: "err" }); return; }
    if (rxBuffer.current.includes(BLE.DONE_MARKER)) { log(t("log.received")); handlePacket(rxBuffer.current, dev.current?.name ?? t("analyzer")); }
  }

  function onDemo() {
    const packet = buildPacket(SCENARIOS[scenario]);
    log(t("log.demoRun", { scenario: t(`scenario.${scenario}`) }));
    handlePacket(packet, t("demoAnalyzer"));
  }

  async function handlePacket(buf: string, deviceName: string) {
    const values = yocheckToInternal(parsePacket(buf));
    setBusy(true);
    setStatus({ key: "analyzing", tone: "busy" });
    try {
      const post = await fetch("/api/v1/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values, source: "analyzer", device: deviceName, ...(patient ? { patient_id: patient.id } : {}) }),
      });
      if (!post.ok) throw new Error((await post.json()).detail ?? t("measureFailed"));
      const { assessment_id } = await post.json();
      setStatus({ key: "done", tone: "ok" });
      log(t("log.analyzed"));
      router.push(patient ? `/clinician/patients/${patient.id}` : `/result/${assessment_id}`);
    } catch (e) {
      log(t("log.analyzeFailed", { message: (e as Error).message }));
      setStatus({ key: "analyzeFailed", tone: "err" });
      setBusy(false);
    }
  }

  const toneColor = { idle: "#6b7280", busy: "#9a7400", ok: "#1a8f84", err: "#c0392b" }[status.tone];

  return (
    <main className="mx-auto max-w-2xl px-5 py-6 font-sans">
      {patient && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#2E5A88]/20 bg-[#2E5A88]/5 px-4 py-3 text-sm">
          <Link href={`/clinician/patients/${patient.id}`} className="text-gray-400">← {t("backToPatient")}</Link>
          <span className="ml-auto text-gray-500">{t("patientTarget")}</span>
          <b className="text-[#2E5A88]">{patient.name}</b>
          <span className="text-xs text-gray-400">{patient.pseudoId}</span>
        </div>
      )}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E5A88]">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("lead")}</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: toneColor }}>{t(`status.${status.key}`)}</span>
      </header>

      {/* 검사기 연결 */}
      <section className="rounded-xl border border-gray-200 p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("connectTitle")}</h2>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onConnect} disabled={connected || busy}
            className="rounded-lg bg-[#2E5A88] py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            {t("scanConnect")}
          </button>
          <button onClick={onMeasure} disabled={!connected || busy}
            className="rounded-lg border border-[#2E5A88] py-2.5 text-sm font-semibold text-[#2E5A88] disabled:opacity-40">
            {t("startMeasure")}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">{t("bleNote")}</p>
      </section>

      {/* 데모 측정 */}
      <section className="mt-4 rounded-xl border-l-4 border-[#E8B500] bg-amber-50/40 p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">{t("demoTitle")}</h2>
        <div className="flex gap-2">
          <select value={scenario} onChange={(e) => setScenario(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-2 py-2 text-sm">
            {Object.keys(SCENARIOS).map((k) => <option key={k} value={k}>{t(`scenario.${k}`)}</option>)}
          </select>
          <button onClick={onDemo} disabled={busy}
            className="rounded-lg bg-[#E8B500] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {t("runDemo")}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">{t("demoNote")}</p>
      </section>

      {logs.length > 0 && (
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-[#0b1220] p-3 text-[11px] leading-relaxed text-[#a3e635]">
          {logs.join("\n")}
        </pre>
      )}
    </main>
  );
}
