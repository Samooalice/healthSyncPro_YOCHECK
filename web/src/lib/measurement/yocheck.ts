// yocheck_pet 요화학 측정기 연동 — BLE(NUS) 프로토콜 상수 · 패킷 파싱 ·
// 측정기 원시값 → 내부 분석 코드 변환.
// 출처: sdc_deploy/petdaycare ble_test.html, ai/grading.py (BLE_ITEMS, grade 규칙)
import type { Analyte } from "@/config/algoParams";

// ── BLE (Nordic UART Service) 상수 ──
export const BLE = {
  SERVICE_UUID: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  NOTIFY_UUID: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
  WRITE_UUID: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  NAME_KEYWORDS: ["YOCHECK", "PhotoMT", "OptoSta"],
  COMMAND_TS_HEX: "2554530a", // "%TS\n"
  DONE_MARKER: "#A11",
} as const;

// ── 11종 항목 메타 (순서 = 패킷 #R01~#R11). 측정기 코드 'ketones' = 내부 'ketone' ──
export interface YItem {
  idx: number;
  code: string; // 측정기 코드
  analyte: Analyte; // 내부 코드
  name: string;
  kind: "qual" | "num";
}

export const YOCHECK_ITEMS: YItem[] = [
  { idx: 1, code: "blood", analyte: "blood", name: "잠혈", kind: "qual" },
  { idx: 2, code: "bilirubin", analyte: "bilirubin", name: "빌리루빈", kind: "qual" },
  { idx: 3, code: "urobilinogen", analyte: "urobilinogen", name: "우로빌리노겐", kind: "num" },
  { idx: 4, code: "ketones", analyte: "ketone", name: "케톤", kind: "qual" },
  { idx: 5, code: "protein", analyte: "protein", name: "단백질", kind: "qual" },
  { idx: 6, code: "nitrite", analyte: "nitrite", name: "아질산염", kind: "qual" },
  { idx: 7, code: "glucose", analyte: "glucose", name: "포도당", kind: "qual" },
  { idx: 8, code: "ph", analyte: "ph", name: "pH", kind: "num" },
  { idx: 9, code: "specific_gravity", analyte: "specific_gravity", name: "비중", kind: "num" },
  { idx: 10, code: "leukocyte", analyte: "leukocyte", name: "백혈구", kind: "qual" },
  { idx: 11, code: "vitamin_c", analyte: "vitamin_c", name: "비타민C", kind: "qual" },
];

// 항목별 반정량 상한 (A.1): 대부분 0~4, nitrite 0~1, bilirubin·vitamin_c 0~3
const QUAL_MAX: Partial<Record<Analyte, number>> = {
  nitrite: 1,
  bilirubin: 3,
  vitamin_c: 3,
};

const pad2 = (n: number) => (n < 10 ? "0" + n : "" + n);

/** 측정기 패킷에서 항목별 원시 문자열 추출 (#R{idx}:value#T{idx}). */
export function parsePacket(buf: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const it of YOCHECK_ITEMS) {
    const start = `#R${pad2(it.idx)}:`;
    const end = `#T${pad2(it.idx)}`;
    const s = buf.indexOf(start);
    const e = buf.indexOf(end);
    out[it.code] = s !== -1 && e !== -1 && s < e ? buf.substring(s + start.length, e).trim() : "";
  }
  return out;
}

/** 측정기 입력값 → 검사기 패킷 합성 (데모/테스트용, 앱 수신 구조와 동일). */
export function buildPacket(values: Record<string, string>): string {
  let buf = "";
  for (const it of YOCHECK_ITEMS) {
    buf += `#R${pad2(it.idx)}:${values[it.code] ?? ""}#T${pad2(it.idx)}`;
  }
  return buf + BLE.DONE_MARKER;
}

const numOf = (s: string): number | null => {
  const m = /-?\d+(\.\d+)?/.exec(String(s));
  return m ? Number(m[0]) : null;
};

/** 정성 항목 문자열 → 내부 반정량 코드(0~4). 음성0·미량1·1+2·2+3·3+이상4. */
function qualToCode(raw: string): number {
  const v = (raw || "").trim().toLowerCase();
  if (v === "" || v === "0" || v === "0.0" || v === "-" || v === "neg" || v === "negative" || v === "음성")
    return 0;
  if (v.includes("trace") || v.includes("미량") || v === "±" || v === "+-" || v === "+/-") return 1;
  // '1+','2+','3+','4+'
  const grade = /(\d)\s*\+/.exec(v);
  if (grade) return Math.min(4, Number(grade[1]) + 1);
  // '+','++','+++'
  const plus = (v.match(/\+/g) || []).length;
  if (plus > 0) return Math.min(4, plus + 1);
  if (v.includes("양성") || v.includes("pos") || v.includes("positive")) return 2;
  const n = numOf(v);
  return n != null && n > 0 ? 1 : 0;
}

export type InternalValues = Partial<Record<Analyte, number>>;

/**
 * 측정기 원시값(코드별 문자열) → 내부 분석 입력값(숫자).
 * 수치 항목(ph/비중/우로빌리노겐)은 실수, 정성 항목은 반정량 코드(상한 클램프).
 */
export function yocheckToInternal(raw: Record<string, string>): InternalValues {
  const out: InternalValues = {};
  for (const it of YOCHECK_ITEMS) {
    const r = raw[it.code];
    if (it.kind === "num") {
      const n = numOf(r ?? "");
      if (n != null) out[it.analyte] = n;
      else if (it.analyte === "urobilinogen") out[it.analyte] = 0.2; // NEG → 정상 기준
    } else {
      let code = qualToCode(r ?? "");
      const max = QUAL_MAX[it.analyte] ?? 4;
      if (code > max) code = max;
      out[it.analyte] = code;
    }
  }
  return out;
}
