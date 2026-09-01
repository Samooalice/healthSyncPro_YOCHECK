// 알림 문구 카탈로그 매핑 + 화면 재렌더링.
//
// 알림 행에는 생성 시점의 기준어(ko) 문장이 남는다. 사용자가 언어를 바꿔도
// 지난 알림이 한국어로 남지 않도록, 알림함은 template_id 로 현재 언어에서 다시 그린다.
// 그래서 템플릿 변수는 "행만 보고 재구성 가능한 것"으로 제한한다 — 지금은 {disease} 뿐이고,
// 이는 ref_type="assessment" 의 평가 레코드에서 되찾는다.
import type { Translate } from "@/i18n/t";

export const NOTIFY_TEMPLATES = {
  NT_RESULT_READY: { title: "notify.resultReady.title", body: "notify.resultReady.body" },
  NT_RISK: { title: "notify.risk.title", body: "notify.risk.body" },
  NT_REFERRAL: { title: "notify.referral.title", body: "notify.referral.body" },
  NT_FEEDBACK: { title: "notify.feedback.title", body: "notify.feedback.body" },
} as const;

export type NotifyTemplateId = keyof typeof NOTIFY_TEMPLATES;

function isKnown(id: string | null): id is NotifyTemplateId {
  return !!id && id in NOTIFY_TEMPLATES;
}

export interface NotificationRow {
  template_id: string | null;
  title: string;
  body: string;
  ref_type: string | null;
  ref_id: string | null;
}

/**
 * 저장된 알림 행 → 현재 언어 문장.
 * 알 수 없는 template_id(운영자가 DB에서 직접 만든 알림 등)는 저장된 문장을 그대로 쓴다.
 */
export function localizeNotification(
  t: Translate,
  row: NotificationRow,
  diseaseByAssessment?: Map<string, string>,
): { title: string; body: string } {
  if (!isKnown(row.template_id)) return { title: row.title, body: row.body };
  const spec = NOTIFY_TEMPLATES[row.template_id];

  const vars: Record<string, string> = {};
  if (row.template_id === "NT_RISK") {
    const dz = row.ref_type === "assessment" && row.ref_id
      ? diseaseByAssessment?.get(row.ref_id)
      : undefined;
    // 평가 레코드를 못 찾으면(삭제 등) 저장된 문장으로 폴백한다.
    if (!dz) return { title: row.title, body: row.body };
    vars.disease = t(`disease.${dz}`);
  }

  return { title: t(spec.title, vars), body: t(spec.body, vars) };
}
