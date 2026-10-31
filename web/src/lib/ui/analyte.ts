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

// ── 판정 배지 ──
// pH·비중·비타민C 는 질환 위험 판정이 아니라 "기준 측정값"이다. YoCheck 어플과 같이
// 회색 배지에 단계 이름(산성·약산성… / -·+·++…)을 붙인다. 나머지 항목은 정상·주의·이상.
export const REFERENCE_ANALYTES = new Set(["ph", "specific_gravity", "vitamin_c"]);

const PH_LEVELS = ["acidic", "weakAcidic", "neutral", "alkaline", "strongAlkaline"];

/** 등급 → 기호. 0 = "-", 1 = "+", 2 = "++" … (언어 공통 기호라 번역하지 않는다). */
const plusMarks = (grade: number) => (grade <= 0 ? "-" : "+".repeat(grade));

/** 기준 측정값 항목의 단계 이름. 해당 항목이 아니면 null. */
export function referenceLabel(t: Translate, a: string, v: number): string | null {
  if (a === "ph") {
    // 검사기 등급 pH 5·6·7·8·9 기준. 데모·수기 입력의 소수(6.5 등)는 가까운 쪽으로.
    const i = v <= 5.5 ? 0 : v <= 6.5 ? 1 : v < 7.5 ? 2 : v < 8.5 ? 3 : 4;
    return t(`phLevel.${PH_LEVELS[i]}`);
  }
  if (a === "specific_gravity") {
    // 검사기 등급 1.000·1.005·1.015·1.025·1.030 → -·+·++·+++·++++
    const g = v < 1.0025 ? 0 : v < 1.01 ? 1 : v < 1.02 ? 2 : v < 1.0275 ? 3 : 4;
    return plusMarks(g);
  }
  if (a === "vitamin_c") return plusMarks(Math.round(v));
  return null;
}

/** 결과 표의 판정 배지 문구·색. */
export function analyteBadge(t: Translate, a: string, v: number | null | undefined): { label: string; color: string } {
  if (v != null && REFERENCE_ANALYTES.has(a)) {
    const label = referenceLabel(t, a, v);
    if (label) return { label, color: STATUS_COLOR.info };
  }
  const st = analyteStatus(a, v);
  return { label: statusLabel(t, st), color: STATUS_COLOR[st] };
}
