// 요화학 항목 메타 — 정상범위·값 표기·상태 판정 (개발방안 2.1 / 세부데이터 A.1·B.5)
export type AnalyteKind = "semi" | "num";
export interface AnalyteMeta {
  name: string;
  kind: AnalyteKind;
  normal: [number, number]; // semi: 코드 정상범위(보통 0~0), num: 실수 범위
  unit?: string;
  semiMax?: number;
}

export const ANALYTE_META: Record<string, AnalyteMeta> = {
  protein: { name: "요단백", kind: "semi", normal: [0, 0], semiMax: 4 },
  glucose: { name: "요당", kind: "semi", normal: [0, 0], semiMax: 4 },
  blood: { name: "잠혈", kind: "semi", normal: [0, 0], semiMax: 4 },
  leukocyte: { name: "백혈구", kind: "semi", normal: [0, 0], semiMax: 4 },
  ketone: { name: "케톤", kind: "semi", normal: [0, 0], semiMax: 4 },
  nitrite: { name: "아질산염", kind: "semi", normal: [0, 0], semiMax: 1 },
  bilirubin: { name: "빌리루빈", kind: "semi", normal: [0, 0], semiMax: 3 },
  urobilinogen: { name: "유로빌리노겐", kind: "num", normal: [0.1, 1.0], unit: "mg/dL" },
  ph: { name: "산도(pH)", kind: "num", normal: [4.5, 8.0] },
  specific_gravity: { name: "비중", kind: "num", normal: [1.005, 1.03] },
  vitamin_c: { name: "비타민C", kind: "semi", normal: [0, 0], semiMax: 3 },
};

const SEMI_LABEL = ["음성", "미량", "1+", "2+", "3+", "4+"];

export function formatAnalyte(a: string, v: number | null | undefined): string {
  if (v == null) return "-";
  const m = ANALYTE_META[a];
  if (!m) return String(v);
  if (m.kind === "semi") return SEMI_LABEL[Math.round(v)] ?? `${v}`;
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

export function normalText(a: string): string {
  const m = ANALYTE_META[a];
  if (!m) return "-";
  if (m.kind === "semi") return "음성";
  return `${m.normal[0]}~${m.normal[1]}${m.unit ? " " + m.unit : ""}`;
}

export const STATUS_COLOR: Record<Status, string> = {
  normal: "#2E9E5B",
  caution: "#C79100",
  abnormal: "#D4691B",
  info: "#6b7280",
};
export const STATUS_LABEL: Record<Status, string> = {
  normal: "정상", caution: "주의", abnormal: "이상", info: "참고",
};
