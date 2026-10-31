// yocheck_pet 요화학 측정기 연동 — BLE(NUS) 프로토콜 상수 · 패킷 파싱 ·
// 측정기 원시값 → 내부 분석 코드 변환.
// 출처: sdc_deploy/petdaycare ble_test.html, ai/grading.py (BLE_ITEMS, grade 규칙),
//       YoCheck Gold APK lib/common/utils/branch.dart (05_데이터_매핑.md — raw→status 환산)
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
  kind: "qual" | "num";
}
// 표시용 항목명은 messages/*.json 의 analyte.* 를 쓴다(여기에 중복 정의하지 않는다).

export const YOCHECK_ITEMS: YItem[] = [
  { idx: 1, code: "blood", analyte: "blood", kind: "qual" },
  { idx: 2, code: "bilirubin", analyte: "bilirubin", kind: "qual" },
  { idx: 3, code: "urobilinogen", analyte: "urobilinogen", kind: "num" },
  { idx: 4, code: "ketones", analyte: "ketone", kind: "qual" },
  { idx: 5, code: "protein", analyte: "protein", kind: "qual" },
  { idx: 6, code: "nitrite", analyte: "nitrite", kind: "qual" },
  { idx: 7, code: "glucose", analyte: "glucose", kind: "qual" },
  { idx: 8, code: "ph", analyte: "ph", kind: "num" },
  { idx: 9, code: "specific_gravity", analyte: "specific_gravity", kind: "num" },
  { idx: 10, code: "leukocyte", analyte: "leukocyte", kind: "qual" },
  { idx: 11, code: "vitamin_c", analyte: "vitamin_c", kind: "qual" },
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

/**
 * 정성 항목 문자열 → 내부 반정량 코드(0~4). 음성0·미량1·1+2·2+3·3+이상4.
 *
 * i18n:skip — 아래 "음성"·"미량"·"양성" 은 화면 문구가 아니라 **측정기가 보내는
 * 프로토콜 값**이다. 기기 펌웨어가 한국어 토큰을 그대로 실어 보내므로 번역하면
 * 파싱이 깨진다. 영문 토큰(neg/trace/pos)도 함께 받는다.
 */
function qualToCode(raw: string): number {
  // i18n:skip-start
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
  // i18n:skip-end
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

// ── 실제 검사기(BLE) 원시값 → 등급 환산 ──
// 검사기는 "음성"·"1.025" 같은 판정값이 아니라 센서 raw double(예: 53.7)을 보낸다.
// 아래 표는 YoCheck Gold APK Branch.urineGradeResult 를 그대로 옮긴 것(05_데이터_매핑.md §5.2).
// 각 함수는 raw → status(0~4) 를 돌려준다.
type Grader = (x: number) => number;
const RAW_GRADE: Record<string, Grader> = {
  // DT01 잠혈 (APK 원본: 52 미만 구간은 정의 없음 → 0 으로 처리)
  blood: (x) => (x >= 130 ? 3 : x >= 100 ? 2 : x >= 57 ? 1 : 0),
  // DT02 빌리루빈
  bilirubin: (x) => (x >= 41 ? 0 : x >= 35 ? 1 : x >= 28 ? 2 : 3),
  // DT03 우로빌리노겐
  urobilinogen: (x) => (x >= 42 ? 0 : x >= 39 ? 1 : x >= 30 ? 2 : x >= 21 ? 3 : 4),
  // DT04 케톤 (APK 원본 구간 그대로: 22 미만이 2, 22~30.5 가 3)
  ketones: (x) => (x >= 40 ? 0 : x >= 30.5 ? 1 : x >= 22 ? 3 : 2),
  // DT05 단백질
  protein: (x) => (x >= 140 ? 4 : x >= 122 ? 3 : x >= 110 ? 2 : x >= 60 ? 1 : 0),
  // DT06 아질산염
  nitrite: (x) => (x >= 42 ? 0 : 1),
  // DT07 포도당
  glucose: (x) => (x >= 100 ? (x >= 170 ? 0 : 1) : x >= 46 ? 2 : x >= 21 ? 3 : 4),
  // DT08 pH (status 0~4 = pH 5~9)
  ph: (x) => (x >= 200 ? 4 : x >= 100 ? 3 : x >= 50 ? 2 : x >= 20 ? 1 : 0),
  // DT09 비중
  specific_gravity: (x) => (x >= 200 ? 0 : x >= 90 ? 1 : x >= 75 ? 2 : x >= 41 ? 3 : 4),
  // DT10 백혈구
  leukocyte: (x) => (x >= 42 ? 0 : x >= 40.2 ? 1 : x >= 35.5 ? 2 : 3),
  // DT11 비타민C
  vitamin_c: (x) => (x >= 110 ? 0 : x >= 30 ? 1 : x >= 13 ? 2 : 3),
};

// 수치 항목의 status → 표시 수치 (05_데이터_매핑.md §5.3.2)
const STATUS_TO_NUMBER: Partial<Record<Analyte, number[]>> = {
  ph: [5, 6, 7, 8, 9],
  specific_gravity: [1.0, 1.005, 1.015, 1.025, 1.03],
  urobilinogen: [0.1, 1, 2, 4, 8],
};

/** 측정기 raw 문자열 → 등급(status 0~4). 값이 없거나 숫자가 아니면 null. */
export function rawToStatus(code: string, raw: string): number | null {
  const x = numOf(raw ?? "");
  const g = RAW_GRADE[code];
  return x == null || !g ? null : g(x);
}

/**
 * 실제 검사기(BLE) 패킷의 raw 값 → 내부 분석 입력값.
 * 정성 항목은 status 를 반정량 코드(0~4)로, 수치 항목은 status 에 대응하는 대표 수치로 바꾼다.
 */
export function yocheckRawToInternal(raw: Record<string, string>): InternalValues {
  const out: InternalValues = {};
  for (const it of YOCHECK_ITEMS) {
    const st = rawToStatus(it.code, raw[it.code]);
    if (st == null) continue;
    const nums = STATUS_TO_NUMBER[it.analyte];
    if (nums) out[it.analyte] = nums[Math.min(st, nums.length - 1)];
    else out[it.analyte] = Math.min(st, QUAL_MAX[it.analyte] ?? 4);
  }
  return out;
}
