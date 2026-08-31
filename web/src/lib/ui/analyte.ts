// 요화학 항목 메타 — 정상범위·값 표기·상태 판정 (개발방안 2.1 / 세부데이터 A.1·B.5)
// 표시 문구는 전부 messages/*.json 으로 옮겼다. 여기 남은 것은 언어 무관한 수치·형식뿐이다.
import type { Translate } from "@/i18n/t";

export type AnalyteKind = "semi" | "num";
export interface AnalyteMeta {
  kind: AnalyteKind;
  normal: [number, number]; // semi: 코드 정상범위(보통 0~0), num: 실수 범위
  unit?: string;
  semiMax?: number;
}

export const ANALYTE_META: Record<string, AnalyteMeta> = {
  protein: { kind: "semi", normal: [0, 0], semiMax: 4 },
  glucose: { kind: "semi", normal: [0, 0], semiMax: 4 },
  blood: { kind: "semi", normal: [0, 0], semiMax: 4 },
  leukocyte: { kind: "semi", normal: [0, 0], semiMax: 4 },
  ketone: { kind: "semi", normal: [0, 0], semiMax: 4 },
  nitrite: { kind: "semi", normal: [0, 0], semiMax: 1 },
  bilirubin: { kind: "semi", normal: [0, 0], semiMax: 3 },
  urobilinogen: { kind: "num", normal: [0.1, 1.0], unit: "mg/dL" },
  ph: { kind: "num", normal: [4.5, 8.0] },
  specific_gravity: { kind: "num", normal: [1.005, 1.03] },
  vitamin_c: { kind: "semi", normal: [0, 0], semiMax: 3 },
};

/** 항목명. 카탈로그에 없으면 키를 그대로 돌려준다(무음 실패 방지). */
export function analyteName(t: Translate, a: string): string {
  const s = t(`analyte.${a}`);
  return s === `analyte.${a}` ? a : s;
}

/** 반정량 등급 표기(음성/미량/1+…). 1+ 이상은 언어 공통 기호라 카탈로그에서도 동일하다. */
const SEMI_KEYS = ["negative", "trace", "p1", "p2", "p3", "p4"];

export function formatAnalyte(t: Translate, a: string, v: number | null | undefined): string {
  if (v == null) return "-";
  const m = ANALYTE_META[a];
  if (!m) return String(v);
  if (m.kind === "semi") {
    const k = SEMI_KEYS[Math.round(v)];
    return k ? t(`analyteValue.${k}`) : `${v}`;
  }
  return `${v}${m.unit ? " " + m.unit : ""}`;
}

export type Status = "normal" | "caution" | "abnormal" | "info";

export function analyteStatus(a: string, v: number | null | undefined): Status {
  if (v == null) return "normal";
  if (a === "vitamin_c") return v > 0 ? "info" : "normal"; // 교란 참고
  const m = ANALYTE_META[a];
  if (!m) return "normal";
  if (m.kind === "semi") return v <= 0 ? "normal" : v === 1 ? "caution" : "abnormal";
  const [lo, hi] = m.normal;
  const margin = (hi - lo) * 0.1;
  if (v >= lo && v <= hi) return "normal";
  if (v >= lo - margin && v <= hi + margin) return "caution";
  return "abnormal";
}

export function normalText(t: Translate, a: string): string {
  const m = ANALYTE_META[a];
  if (!m) return "-";
  if (m.kind === "semi") return t("analyteValue.negative");
  return `${m.normal[0]}~${m.normal[1]}${m.unit ? " " + m.unit : ""}`;
}

export const STATUS_COLOR: Record<Status, string> = {
  normal: "#2E9E5B",
  caution: "#C79100",
  abnormal: "#D4691B",
  info: "#6b7280",
};

export function statusLabel(t: Translate, s: Status): string {
  return t(`status.${s}`);
}
