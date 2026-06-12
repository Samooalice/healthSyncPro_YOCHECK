// 마이헬스데이터(나의건강기록 FHIR PHR) 파서 — sdc_deploy phr_ingest.py 의 TS 이식.
// 외부 의존 없는 순수 로직. publicData(FHIR 리소스 배열) → 구조화 요약 + 만성질환 플래그.
/* eslint-disable @typescript-eslint/no-explicit-any */

// 검진 Observation display → 표준 메트릭 키
const METRIC_MAP: Record<string, string> = {
  "체질량지수": "bmi",
  "*혈압_수축기": "sbp",
  "*혈압_이완기": "dbp",
  "혈압": "bp",
  "공복혈당": "glucose",
  "총콜레스테롤": "chol",
  "고밀도콜레스테롤": "hdl",
  "저밀도콜레스테롤": "ldl",
  "중성지방": "tg",
  "혈청크레아티닌": "creatinine",
  "신사구체여과율(e-GFR)": "egfr",
  "요단백": "urine_protein",
  "혈색소": "hb",
  "허리둘레": "waist",
  "몸무게": "weight",
  "키": "height",
};
const OPINION_MAP: Record<string, string> = {
  "종합소견_의심질환": "suspect",
  "종합소견_유질환": "disease",
  "종합소견_생활습관관리": "lifestyle",
  "기타": "etc",
};
const MED_CLASS: Record<string, string[]> = {
  "당뇨": ["메트포르민", "메트포민", "시타글립틴", "자누메트", "다파글리플로진", "엔블로멧", "글리메피리드", "이나보글리플로진", "트루다파", "답플로", "디파글루"],
  "고혈압": ["암로디핀", "올메사르탄", "로사르탄", "발사르탄", "텔미사르탄", "세비카", "히드로클로로티아지드", "카르베딜롤", "라미프릴"],
  "이상지질혈증": ["로수바스타틴", "아토르바스타틴", "심바스타틴", "스타틴", "로베틴", "로스틴", "로베스타", "에제티미브"],
  "위장질환": ["라베프라졸", "테고프라잔", "자스타프라잔", "모사프리드", "레바미피드", "라푸티딘", "판토프라졸", "에소메프라졸", "알긴산"],
};

function num(s: any): number | null {
  if (s == null) return null;
  const m = /^\s*0*([0-9]+(?:\.[0-9]+)?)/.exec(String(s));
  return m ? Number(m[1]) : null;
}
function note(s: any): string {
  if (s == null) return "";
  const t = String(s).trim();
  const m = /^[0-9./]+\s*(.*)$/.exec(t);
  return m ? m[1].trim() : t;
}
function obsValue(o: any): string | null {
  if ("valueString" in o) return o.valueString;
  if ("valueQuantity" in o) { const q = o.valueQuantity; return `${q.value ?? ""} ${q.unit ?? ""}`.trim(); }
  for (const k of ["valueInteger", "valueBoolean"]) if (k in o) return String(o[k]);
  if ("valueCodeableConcept" in o) return o.valueCodeableConcept.text ?? "";
  return null;
}
function birthFromRnn(patient: any): [string, string] {
  for (const idf of patient.identifier ?? []) {
    const codes = (idf.type?.coding ?? []).map((c: any) => c.code);
    if (codes.includes("NNKOR")) {
      const v = String(idf.value ?? "").replace(/-/g, "");
      if (v.length >= 7 && /^\d{6}/.test(v)) {
        const [yy, mm, dd, g] = [v.slice(0, 2), v.slice(2, 4), v.slice(4, 6), v[6]];
        const century = "1234".includes(g) ? "19" : "5678".includes(g) ? "20" : "19";
        const gender = "1357".includes(g) ? "M" : "2468".includes(g) ? "F" : "";
        return [`${century}${yy}${mm}${dd}`, gender];
      }
    }
  }
  return ["", ""];
}

interface Metric { num: number | null; note: string; raw: string }
interface Checkup { date: string; org: string; metrics: Record<string, Metric | string>; opinions: Record<string, string> }

function parseCheckup(dr: any): Checkup {
  let date = "", org = "";
  const metrics: Record<string, Metric | string> = {};
  const opinions: Record<string, string> = {};
  for (const c of dr.contained ?? []) {
    const rt = c.resourceType;
    if (rt === "Organization") { org = c.name || org; }
    else if (rt === "Observation") {
      const disp = c.code?.text || c.code?.coding?.[0]?.display || "";
      const raw = obsValue(c);
      date = c.effectiveDateTime || date;
      if (raw == null || raw === "") continue;
      if (disp in OPINION_MAP) opinions[OPINION_MAP[disp]] = String(raw).trim();
      else if (disp in METRIC_MAP) {
        const key = METRIC_MAP[disp];
        if (key === "bp") { metrics["bp_text"] = String(raw).trim(); continue; }
        let n = num(raw);
        if ((key === "weight" || key === "height") && n && n > 250) n = n / 10.0;
        if (n === 0) n = null; // 검진 수치 0 = 미측정(결측). 추세 계산 왜곡 방지
        metrics[key] = { num: n, note: note(raw), raw: String(raw).trim() };
      }
    }
  }
  return { date, org, metrics, opinions };
}
function classifyMed(text: string): string {
  for (const [cls, kws] of Object.entries(MED_CLASS)) if (kws.some((kw) => text.includes(kw))) return cls;
  return "";
}

export interface PhrTrend {
  key: string;
  label: string;
  unit: string;
  normal?: [number, number];
  points: { date: string; value: number }[];
  slope: number; // 연간 변화량(선형회귀 기울기, 단위/년)
  first: number;
  last: number;
  delta: number;
  direction: "up" | "down" | "flat";
  n: number;
}

// 추세를 추출할 검진 항목(라벨·단위·정상범위)
const TREND_METRICS: { key: string; label: string; unit: string; normal?: [number, number] }[] = [
  { key: "glucose", label: "공복혈당", unit: "mg/dL", normal: [70, 100] },
  { key: "egfr", label: "eGFR", unit: "", normal: [90, 120] },
  { key: "bmi", label: "BMI", unit: "", normal: [18.5, 25] },
  { key: "chol", label: "총콜레스테롤", unit: "", normal: [0, 200] },
  { key: "ldl", label: "LDL콜레스테롤", unit: "", normal: [0, 130] },
  { key: "tg", label: "중성지방", unit: "", normal: [0, 150] },
  { key: "creatinine", label: "크레아티닌", unit: "", normal: [0.5, 1.2] },
  { key: "hb", label: "혈색소", unit: "", normal: [12, 17] },
  { key: "weight", label: "체중", unit: "kg" },
  { key: "waist", label: "허리둘레", unit: "cm" },
];

function yearFrac(date: string): number {
  const [y, m, d] = (date ?? "").split("-").map(Number);
  if (!y) return 0;
  return y + ((m || 1) - 1) / 12 + (d || 15) / 365;
}
function linregSlope(pts: { t: number; v: number }[]): number {
  const n = pts.length;
  if (n < 2) return 0;
  const mt = pts.reduce((a, p) => a + p.t, 0) / n;
  const mv = pts.reduce((a, p) => a + p.v, 0) / n;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.t - mt) * (p.v - mv); den += (p.t - mt) ** 2; }
  return den ? num / den : 0;
}
/** 검진 회차들에서 항목별 시계열·추세(연간 기울기)를 산출. 결측(null/0)은 제외. */
function buildTrends(checkups: Checkup[]): PhrTrend[] {
  const asc = [...checkups].filter((c) => c.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const out: PhrTrend[] = [];
  for (const def of TREND_METRICS) {
    const points = asc
      .map((c) => {
        const mm = c.metrics[def.key];
        const v = mm && typeof mm === "object" ? (mm as Metric).num : null;
        return v != null && v > 0 ? { date: c.date, value: v } : null;
      })
      .filter((p): p is { date: string; value: number } => p !== null);
    if (points.length < 1) continue;
    const slope = linregSlope(points.map((p) => ({ t: yearFrac(p.date), v: p.value })));
    const first = points[0].value, last = points[points.length - 1].value;
    const delta = Number((last - first).toFixed(2));
    const direction: PhrTrend["direction"] = Math.abs(delta) < 1e-9 ? "flat" : delta > 0 ? "up" : "down";
    out.push({ ...def, points, slope: Number(slope.toFixed(3)), first, last, delta, direction, n: points.length });
  }
  return out;
}

export interface PhrFlags {
  diabetes: boolean; hypertension: boolean; dyslipidemia: boolean;
  kidney_watch: boolean; overweight: boolean;
  glucose: number | null; egfr: number | null; bmi: number | null; urine_protein_note: string;
  glucose_slope?: number; egfr_slope?: number; bmi_slope?: number; // 연간 추세(악화 조기신호)
}
export interface PhrSummary {
  patient: { name?: string; birth?: string; gender?: string };
  resource_count: number;
  checkups: Checkup[];
  medications: { name: string; count: number; cls: string }[];
  med_classes: string[];
  diagnoses: string[];
  immunizations: { vaccine: string; date: string }[];
  claims_count: number;
  flags: PhrFlags;
  trends: PhrTrend[];
}

/** 업로드 JSON 한 개에서 FHIR 리소스 배열 추출. {publicData}/{entry}/배열/단일 리소스 허용. */
export function extractPublicData(obj: any): any[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    if (Array.isArray(obj.publicData)) return obj.publicData;
    if (Array.isArray(obj.entry)) return obj.entry;
    if (obj.resourceType) return [obj]; // 단일 리소스
  }
  return [];
}

/** FHIR 리소스 누적 병합 시 중복 제거 — (resourceType,id) 기준, 없으면 내용 해시. */
export function dedupeResources(items: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const it of items ?? []) {
    const res = it && typeof it === "object" && "resource" in it ? it.resource : it;
    const rt = res && typeof res === "object" ? res.resourceType ?? "" : "";
    const rid = res && typeof res === "object" ? res.id ?? "" : "";
    const key = rt && rid ? `id:${rt}:${rid}` : `hash:${JSON.stringify(res)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** 리소스 배열의 첫 Patient 에서 이름 추출(업로드 주인 검증용). */
export function phrOwnerName(resources: any[]): string {
  for (const it of resources ?? []) {
    const r = it && typeof it === "object" && "resource" in it ? it.resource : it;
    if (r && typeof r === "object" && r.resourceType === "Patient") {
      return (r.name?.[0]?.text ?? "").trim();
    }
  }
  return "";
}

export function parsePhr(publicData: any[]): PhrSummary {
  const res = (publicData ?? []).map((x) => (x.resource ? x.resource : x));

  let patient: PhrSummary["patient"] = {};
  for (const r of res) {
    if (r.resourceType === "Patient") {
      const name = r.name?.[0]?.text ?? "";
      const [birth, gender] = birthFromRnn(r);
      patient = { name, birth, gender };
      break;
    }
  }

  let checkups = res.filter((r: any) => r.resourceType === "DiagnosticReport").map(parseCheckup);
  checkups = checkups.filter((c) => Object.keys(c.metrics).length || Object.keys(c.opinions).length);
  checkups.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const medsById: Record<string, any> = {};
  for (const r of res) if (r.resourceType === "Medication") medsById[r.id] = r;
  const counter: Record<string, number> = {};
  for (const d of res.filter((r: any) => r.resourceType === "MedicationDispense")) {
    const ref = String(d.medicationReference?.reference ?? "").split("/").pop() ?? "";
    const med = medsById[ref] ?? {};
    const nm = med.code?.text || med.code?.coding?.[0]?.display || "";
    if (!nm) continue;
    counter[nm] = (counter[nm] ?? 0) + 1;
  }
  const medications = Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, cls: classifyMed(name) }));
  const med_classes = [...new Set(medications.filter((m) => m.cls).map((m) => m.cls))].sort();

  const immunizations = res
    .filter((r: any) => r.resourceType === "Immunization")
    .map((r: any) => ({ vaccine: r.vaccineCode?.text || r.vaccineCode?.coding?.[0]?.display || "", date: r.occurrenceDateTime ?? "" }));

  const diagnoses: string[] = [];
  for (const c of checkups) {
    const d = c.opinions.disease ?? "";
    if (d && d !== "해당사항없음" && d !== "정상입니다." && !diagnoses.includes(d)) diagnoses.push(d);
  }

  const claims_count = res.filter((r: any) => r.resourceType === "ExplanationOfBenefit").length;
  const latest = checkups[0] ?? { metrics: {}, opinions: {} };
  const flags = deriveFlags(latest as Checkup, med_classes, diagnoses);

  // 시계열 추세 — 검진 수치의 연간 변화(악화 조기신호). flags에 핵심 3종 기울기 주입.
  const trends = buildTrends(checkups);
  flags.glucose_slope = trends.find((t) => t.key === "glucose")?.slope ?? 0;
  flags.egfr_slope = trends.find((t) => t.key === "egfr")?.slope ?? 0;
  flags.bmi_slope = trends.find((t) => t.key === "bmi")?.slope ?? 0;

  return { patient, resource_count: res.length, checkups, medications, med_classes, diagnoses, immunizations, claims_count, flags, trends };
}

function deriveFlags(latest: Checkup, medClasses: string[], diagnoses: string[]): PhrFlags {
  const m = latest.metrics ?? {};
  const dzText = diagnoses.join(" ");
  const val = (k: string) => { const v = m[k]; return v && typeof v === "object" ? (v as Metric).num : null; };
  const glucose = val("glucose"), egfr = val("egfr"), bmi = val("bmi");
  const up = m["urine_protein"];
  const upNote = (up && typeof up === "object" ? (up as Metric).raw : "") || "";

  return {
    diabetes: medClasses.includes("당뇨") || dzText.includes("당뇨") || (glucose != null && glucose >= 100),
    hypertension: medClasses.includes("고혈압") || dzText.includes("고혈압"),
    dyslipidemia: medClasses.includes("이상지질혈증"),
    kidney_watch: (egfr != null && egfr < 90) || (upNote !== "" && upNote !== "정상"),
    overweight: bmi != null && bmi >= 25,
    glucose, egfr, bmi, urine_protein_note: upNote,
  };
}
