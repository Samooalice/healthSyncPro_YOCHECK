// 콘텐츠 번역 파일 정합성 검사 (DB 없이 파일만 본다).
//   · ko 시드(seed-content-full/rich)에 있는 콘텐츠 id 를 정본으로 삼는다
//   · 언어별 누락/사장 id
//   · payload 구조 일치 (kind, 섹션/미션/문항 개수, 미션 id, 정답 위치)
// 실행: web 에서  node scripts/i18n-content-check.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data", "content-i18n");
const LOCALES = ["en", "ja", "vi", "zh-Hans", "zh-Hant"];

// ko 정본 id — 시드 스크립트에서 추출
function koIds() {
  const ids = new Set();
  for (const f of ["seed-content-full.mjs", "seed-content-rich.mjs"]) {
    const src = readFileSync(join(__dirname, f), "utf8");
    for (const m of src.matchAll(/"(C-[A-Z0-9-]+)"/g)) ids.add(m[1]);
  }
  return ids;
}

/** payload 를 언어와 무관한 "형태"로 요약 — 구조가 어긋나면 값이 달라진다. */
function shape(p) {
  if (!p) return "none";
  if (p.kind === "article") return `article:${(p.sections ?? []).length}`;
  if (p.kind === "checklist") {
    const m = p.missions ?? [];
    return `checklist:${m.length}:${m.map((x) => `${x.id}/${x.points}`).join(",")}`;
  }
  if (p.kind === "quiz") {
    const q = p.questions ?? [];
    return `quiz:${q.length}:${q.map((x) => `${(x.options ?? []).length}#${(x.options ?? []).findIndex((o) => o.correct)}`).join(",")}`;
  }
  return `other:${p.kind}`;
}

const base = koIds();
const en = existsSync(join(DATA_DIR, "en.json"))
  ? JSON.parse(readFileSync(join(DATA_DIR, "en.json"), "utf8"))
  : {};
// 구조 기준선은 en 을 쓴다(ko 시드는 JS 리터럴이라 파싱이 번거롭다).
const refShape = Object.fromEntries(Object.entries(en).map(([k, v]) => [k, shape(v.payload)]));

let problems = 0;
console.log(`ko 시드 콘텐츠 ${base.size}건 기준\n`);
console.log("언어        보유   누락   사장   구조불일치");
console.log("-".repeat(46));

for (const locale of LOCALES) {
  const f = join(DATA_DIR, `${locale}.json`);
  if (!existsSync(f)) { console.log(`${locale.padEnd(10)} (파일 없음)`); problems++; continue; }
  const d = JSON.parse(readFileSync(f, "utf8"));
  const ids = new Set(Object.keys(d));
  const missing = [...base].filter((id) => !ids.has(id));
  const orphan = [...ids].filter((id) => !base.has(id));
  const badShape = Object.entries(d)
    .filter(([id, v]) => refShape[id] !== undefined && shape(v.payload) !== refShape[id])
    .map(([id]) => id);
  console.log(
    `${locale.padEnd(10)} ${String(ids.size).padStart(4)} ${String(missing.length).padStart(6)} ` +
    `${String(orphan.length).padStart(6)} ${String(badShape.length).padStart(11)}`,
  );
  if (missing.length) { console.log(`   누락: ${missing.join(", ")}`); problems++; }
  if (orphan.length) { console.log(`   사장: ${orphan.join(", ")}`); problems++; }
  for (const id of badShape) {
    console.log(`   구조불일치 ${id}: en=${refShape[id]} / ${locale}=${shape(d[id].payload)}`);
    problems++;
  }
}

console.log(problems === 0 ? "\nOK: 콘텐츠 번역 정합성 이상 없음" : `\n문제 ${problems}건`);
process.exit(problems === 0 ? 0 : 1);
