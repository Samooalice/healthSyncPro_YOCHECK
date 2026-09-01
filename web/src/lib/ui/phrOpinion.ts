// 국가검진 종합소견 문구 번역.
//
// 이 텍스트는 UI 문구가 아니라 **사용자 본인의 건강기록 원문**(검진기관이 쓴 소견)이다.
// 그래서 처리 방식이 다른 문구들과 다르다.
//
//   · 런타임 기계번역은 쓰지 않는다. 진단·소견 텍스트를 외부 번역 서비스로 보내는 것은
//     **PHI 제3자 제공/국외 이전**에 해당해 별도 동의와 법무 검토가 필요하다
//     (개인정보보호법 §17·§28-8). 코드로 결정할 문제가 아니다.
//   · 대신 **문구 사전 + 원문 폴백**을 쓴다. 국가검진 소견은 표준 문구 풀에서 나와
//     정형화되어 있다(현재 데이터 기준 정규화 후 6종). 사전에 없으면 원문을 그대로 보여준다.
//   · 번역은 원문에 충실하게 한다. 소견은 검진기관의 판단이므로, 이 서비스의 권고 톤
//     (지시 표현 회피)을 적용해 부드럽게 바꾸지 않는다.
import type { Translate } from "@/i18n/t";

/**
 * 조회용 정규화 — 같은 문구인데 공백·구두점 뒤 간격이 달라 안 잡히는 경우를 막는다.
 * (실제 데이터에 "필요합니다.일주일에" 와 "필요합니다. 일주일에" 가 함께 있었다)
 */
export function normalizeOpinion(s: string): string {
  return String(s)
    .replace(/\s+/g, " ")
    .replace(/([.,])(?=\S)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

// i18n:skip-start — 아래 한국어는 화면 문구가 아니라 **원문 매칭 키**다.
// 번역문은 messages/*.json 의 phrOpinion.<슬러그> 에 있다.
const OPINION_SLUG: Record<string, string> = {
  "고혈압 / 당뇨병이 잘 조절되고 있습니다. 지속적으로 관리하십시오.": "htn_dm_controlled",
  "주기적인 혈압측정, 운동, 저염식이요함. 체중조절 및 운동 요함. 주기적인 혈당검사 및 운동요함.": "periodic_bp_glucose",
  "단백뇨 추적관찰요망. 체중조절을 위한 식이요법 및 운동하십시오.": "proteinuria_followup",
  "위험음주상태입니다. 절주 또는 금주가 필요합니다. 일주일에 2일 이상 신체 각 부위를 모두 포함하여 근력 운동을 수행하십시오.": "risky_drinking_strength",
  "고위험 음주 상태입니다. 절주 또는 금주가 필요합니다. 신체활동량이 부족합니다. 운동을 생활화하십시오.": "highrisk_drinking_activity",
  "일주일에 2일 이상 신체 각 부위를 모두 포함하여 근력 운동을 수행하십시오.": "strength_training_weekly",
};
// i18n:skip-end

/** 소견 한 건 → 현재 언어. 사전에 없으면 원문 그대로. */
export function opinionText(t: Translate, raw: unknown): string {
  const original = String(raw ?? "").trim();
  if (!original) return "";
  const slug = OPINION_SLUG[normalizeOpinion(original)];
  if (!slug) return original;
  const s = t(`phrOpinion.${slug}`);
  return s === `phrOpinion.${slug}` ? original : s;
}

/** 소견 목록 → 현재 언어 문자열. */
export function opinionList(t: Translate, list: unknown, sep = " · "): string {
  if (!Array.isArray(list)) return "";
  return list.map((d) => opinionText(t, d)).filter(Boolean).join(sep);
}
