// 모든 로케일에서 치환자·복수/서식이 실제로 렌더되는지 확인 (ICU 파싱 오류 조기 검출)
import { createTranslator } from "next-intl";
import { readFileSync } from "node:fs";

const LOCALES = ["ko", "en", "ja", "vi", "zh-Hans", "zh-Hant"];
const SAMPLES = [
  ["common.riskOf", { disease: "X", score: "0.42" }],
  ["dashboard.titleNamed", { name: "홍길동" }],
  ["dashboard.measureCount", { n: 7 }],
  ["driver.urine.high", { name: "A", value: "2+", normal: "음성" }],
  ["driver.sentence.protein_consec_pos", { n: 3 }],
  ["explain.userSignals", { disease: "D", labels: "L1, L2", tone: "T" }],
  ["explain.clinicianStd", { disease: "D", score: "0.5", grade: "high", standard: "A2", contrib: "C" }],
  ["apiError.phrOwnerMismatch", { owner: "홍길동", account: "김철수" }],
  ["missions.doneCount", { done: 2, total: 3 }],
  ["regulatory.prepStarted", { done: 5, total: 9 }],
  ["phr.applied", { addNote: "N", checkups: 4 }],
  ["measure.log.selectedDevice", { name: "YOCHECK" }],
  ["patient.phrCounts", { checkups: 3, meds: 5 }],
  ["report.samdCandidate", { version: "v1" }],
  ["result.samdNote", { model: "m1" }],
];

let fail = 0;
for (const locale of LOCALES) {
  const messages = JSON.parse(readFileSync(`./messages/${locale}.json`, "utf8"));
  const t = createTranslator({ locale, messages });
  for (const [key, vars] of SAMPLES) {
    let out;
    try {
      out = t(key, vars);
    } catch (e) {
      console.log(`FAIL ${locale} ${key}: ${e.message}`);
      fail++;
      continue;
    }
    // 치환자가 그대로 남아 있으면 ICU 인용 등으로 값이 안 채워진 것
    for (const k of Object.keys(vars)) {
      if (String(out).includes(`{${k}}`)) {
        console.log(`LEFTOVER ${locale} ${key}: {${k}} 그대로 남음 -> ${out}`);
        fail++;
      }
    }
  }
}
console.log(fail === 0 ? "OK: 6개 로케일 x 15개 메시지 렌더 정상" : `문제 ${fail}건`);
