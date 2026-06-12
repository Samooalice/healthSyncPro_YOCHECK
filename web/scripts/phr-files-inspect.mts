// 최은섭 phr_*.json 4개 파일이 각각 무엇을 담고 있는지 — resourceType 분포 + 검진(DiagnosticReport) 날짜.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPublicData } from "@/lib/phr/ingest";

const dir = "C:/Users/mycom/Desktop/myhealtData_yochcek/1.doc/최은섭 건강데이터";
const files = readdirSync(dir).filter((f) => f.startsWith("phr_") && f.endsWith(".json")).sort();

for (const f of files) {
  const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const res = extractPublicData(data).map((x: any) => (x?.resource ? x.resource : x));
  const counts: Record<string, number> = {};
  const checkupDates: string[] = [];
  for (const r of res) {
    const rt = r?.resourceType ?? "?";
    counts[rt] = (counts[rt] ?? 0) + 1;
    if (rt === "DiagnosticReport") {
      // contained Observation 의 effectiveDateTime 또는 DR effectiveDateTime
      let date = r.effectiveDateTime ?? "";
      for (const c of r.contained ?? []) if (c.resourceType === "Observation" && c.effectiveDateTime) { date = c.effectiveDateTime; break; }
      checkupDates.push(date || "(날짜미상)");
    }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(", ");
  console.log(`\n[${f}]  리소스 ${res.length}건`);
  console.log(`  종류: ${top}`);
  if (checkupDates.length) console.log(`  검진(DiagnosticReport) 날짜: ${checkupDates.join(" | ")}`);
}
