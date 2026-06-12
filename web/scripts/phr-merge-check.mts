// 다중 파일/누적 병합 검증 — 최은섭 phr_*.json 을 개별 dataset 으로 다뤄 병합·중복제거 확인.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPublicData, dedupeResources, phrOwnerName, parsePhr } from "@/lib/phr/ingest";

const dir = "C:/Users/mycom/Desktop/myhealtData_yochcek/1.doc/최은섭 건강데이터";
const files = readdirSync(dir).filter((f) => f.startsWith("phr_") && f.endsWith(".json"));

// 1) 각 파일을 개별 업로드(dataset)로 취급
const datasets = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
const incoming: unknown[] = [];
for (const d of datasets) incoming.push(...extractPublicData(d));
console.log(`파일 ${files.length}개 → 추출 리소스 ${incoming.length}건`);

// 2) 1차 병합(빈 기존 + 신규)
const first = dedupeResources([...[], ...incoming]);
console.log(`1차 누적 병합(중복제거) → ${first.length}건 (중복 ${incoming.length - first.length}건 제거)`);
console.log(`업로드 주인(Patient): ${phrOwnerName(incoming) || "(이름없음)"}`);

// 3) 같은 파일 재업로드 → 누적되지 않아야(added=0)
const before = dedupeResources(first).length;
const again = dedupeResources([...first, ...incoming]);
console.log(`동일 파일 재업로드 → 총 ${again.length}건, 신규 추가 ${again.length - before}건 (0이어야 정상)`);

// 4) 통합본 파싱
const s = parsePhr(first);
console.log(`파싱: 검진 ${s.checkups.length}회 · 복약 ${s.medications.length}종 · 진단 ${s.diagnoses.length} · 추세 ${s.trends.filter((t) => t.n >= 2).length}종`);
