// PHR 다년치 검진 추세 추출 — 최은섭·윤영순. parsePhr 재사용, DB 미접속.
// 실행: npx tsx scripts/phr-trend.mts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePhr } from "@/lib/phr/ingest";

const BASE = "C:/Users/mycom/Desktop/myhealtData_yochcek/1.doc";
const TARGETS = [
  { name: "최은섭", folder: "최은섭 건강데이터" },
  { name: "윤영순", folder: "윤영순 건강데이터" },
];

const KEYS = ["glucose", "chol", "hdl", "ldl", "tg", "egfr", "creatinine", "bmi", "weight", "waist", "hb", "urine_protein"];

function load(folder: string): any[] {
  const dir = join(BASE, folder);
  const merged: any[] = [];
  for (const f of readdirSync(dir).filter((f) => f.startsWith("phr_") && f.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(join(dir, f), "utf8"));
    merged.push(...(d.publicData ?? []));
  }
  return merged;
}

const out: any = {};
for (const t of TARGETS) {
  const s = parsePhr(load(t.folder));
  const checkups = [...s.checkups].sort((a, b) => (a.date < b.date ? -1 : 1)); // 오름차순
  const series = checkups.map((c) => {
    const row: any = { date: c.date, org: c.org };
    for (const k of KEYS) {
      const m = (c.metrics as any)[k];
      row[k] = m && typeof m === "object" ? m.num : null;
    }
    row.bp = (c.metrics as any).bp_text ?? null;
    row.urine_protein_note = (() => { const m = (c.metrics as any).urine_protein; return m && typeof m === "object" ? m.raw : null; })();
    row.opinion_disease = c.opinions?.disease ?? null;
    row.opinion_suspect = c.opinions?.suspect ?? null;
    return row;
  });
  out[t.name] = {
    parsed_name: s.patient.name, birth: s.patient.birth, gender: s.patient.gender,
    checkup_count: checkups.length,
    date_range: checkups.length ? [checkups[0].date, checkups[checkups.length - 1].date] : [],
    med_classes: s.med_classes, diagnoses: s.diagnoses, flags: s.flags,
    trends: s.trends.filter((x) => x.n >= 2).map((x) => `${x.label} ${x.first}→${x.last} (${x.direction}, slope/yr=${x.slope})`),
    series,
  };
}
console.log(JSON.stringify(out, null, 2));
