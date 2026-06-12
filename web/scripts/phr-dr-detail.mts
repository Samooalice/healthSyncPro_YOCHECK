// 최은섭 검진 보고서(DiagnosticReport) 각각이 담은 검진 항목 + parsePhr 최종 checkups 비교.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPublicData, dedupeResources, parsePhr } from "@/lib/phr/ingest";

const dir = process.argv[2] || "C:/Users/mycom/Desktop/myhealtData_yochcek/1.doc/최은섭 건강데이터";
const merged: any[] = [];
for (const f of readdirSync(dir).filter((f) => f.startsWith("phr_") && f.endsWith(".json"))) {
  merged.push(...extractPublicData(JSON.parse(readFileSync(join(dir, f), "utf8"))));
}
const res = dedupeResources(merged).map((x: any) => (x?.resource ? x.resource : x));

console.log("=== DiagnosticReport(검진 보고서) 원본별 ===");
const drs = res.filter((r: any) => r.resourceType === "DiagnosticReport");
for (const dr of drs) {
  let date = dr.effectiveDateTime ?? "";
  const items: string[] = [];
  for (const c of dr.contained ?? []) {
    if (c.resourceType === "Observation") {
      const disp = c.code?.text || c.code?.coding?.[0]?.display || "?";
      if (c.effectiveDateTime && !date) date = c.effectiveDateTime;
      const val = c.valueQuantity ? `${c.valueQuantity.value}${c.valueQuantity.unit ?? ""}` : (c.valueString ?? "");
      items.push(`${disp}=${val}`);
    }
  }
  console.log(`\n[DR ${date || "(날짜미상)"}] 항목 ${items.length}개: ${items.join(", ")}`);
}

console.log("\n=== parsePhr 최종 checkups (실제 분석에 쓰이는 것) ===");
const s = parsePhr(dedupeResources(merged));
for (const c of s.checkups) {
  console.log(`\n[${c.date}] ${c.org} — metrics ${Object.keys(c.metrics).length}개: ${Object.keys(c.metrics).join(", ")}`);
}
