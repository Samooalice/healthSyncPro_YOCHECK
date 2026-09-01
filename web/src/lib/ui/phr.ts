// 마이헬스데이터(PHR) 표시 라벨 — 화면 3곳(결과·환자상세·임상리포트)이 공유한다.
import type { Translate } from "@/i18n/t";

/**
 * 복약 분류 코드 → 현재 언어.
 *
 * ⚠️ 다국어 전환 전에 파싱된 phr_record 는 분류가 **한국어 문자열**로 저장돼 있다
 *    (당시 MED_CLASS 의 키가 한국어였다). 재파싱 없이도 번역되도록 구 값을 코드로 옮긴다.
 *    알 수 없는 값은 원문 그대로 통과시킨다 — 임의로 지우지 않는다.
 */
// i18n:skip-start — 아래 한국어는 화면 문구가 아니라 **저장된 구 값의 매칭 키**다.
const LEGACY_MED_CLASS: Record<string, string> = {
  "당뇨": "diabetes",
  "고혈압": "hypertension",
  "이상지질혈증": "dyslipidemia",
  "위장질환": "gastro",
};
// i18n:skip-end

export function medClassLabel(t: Translate, value: unknown): string {
  const raw = String(value);
  const code = LEGACY_MED_CLASS[raw] ?? raw;
  const s = t(`medClass.${code}`);
  return s === `medClass.${code}` ? raw : s;
}

export function medClassList(t: Translate, list: unknown): string {
  if (!Array.isArray(list)) return "";
  return list.map((c) => medClassLabel(t, c)).join(", ");
}

/** 검진 항목 라벨 — phrMetric.<key>, 없으면 구 레코드의 label, 그것도 없으면 키. */
export function phrMetricLabel(t: Translate, key: string, fallback?: string): string {
  const s = t(`phrMetric.${key}`);
  return s === `phrMetric.${key}` ? fallback ?? key : s;
}

/**
 * 혈압 표기 — 검진기관이 "120/80 고혈압-전단계" 처럼 **수치 + 분류어**로 기록한다.
 * 수치는 기록 그대로 두고 분류어만 옮긴다. 모르는 분류어는 원문을 유지한다.
 */
export function bpText(t: Translate, raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const m = /^([\d/.\s-]*\d)\s*(.*)$/.exec(s);
  if (!m) return s;
  const [, numbers, category] = m;
  if (!category) return numbers;
  const slug = BP_CATEGORY[category.trim()];
  if (!slug) return s;
  const label = t(`bpCategory.${slug}`);
  return `${numbers} ${label === `bpCategory.${slug}` ? category.trim() : label}`;
}

// i18n:skip-start — 아래 한국어는 화면 문구가 아니라 **검진 기록의 분류어 매칭 키**다.
const BP_CATEGORY: Record<string, string> = {
  "정상": "normal",
  "주의혈압": "elevated",
  "고혈압-전단계": "prehypertension",
  "고혈압전단계": "prehypertension",
  "고혈압": "hypertension",
  "유질환자": "existing_condition",
};
// i18n:skip-end
