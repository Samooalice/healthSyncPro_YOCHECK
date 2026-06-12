-- =====================================================================
-- 시드 데이터 — 콘텐츠/큐레이션/케어규칙/알림템플릿
-- 콘텐츠는 status='draft', medical_review='pending'으로 적재.
-- 의료검수·RA검수 통과 후 published 전환. 큐레이션/케어/알림은 게시 후 활성화.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 콘텐츠 마스터 (P0~P1 18종) — 본문은 콘텐츠 원고 문서 참조
-- ---------------------------------------------------------------------
INSERT INTO content (id, category, title, format, audience, medical_review, status) VALUES
 ('C-ONB-01','result_explain','검사결과 읽는 법(온보딩)','step_guide','user','pending','draft'),
 ('C-RX-GLU','result_explain','요당 결과 해설','card','user','pending','draft'),
 ('C-RX-PRO','result_explain','요단백 결과 해설','card','user','pending','draft'),
 ('C-RX-BLD','result_explain','잠혈 결과 해설','card','user','pending','draft'),
 ('C-RX-LEU','result_explain','백혈구/감염 결과 해설','card','user','pending','draft'),
 ('C-EDU-KID','disease_edu','만성신장질환 이해하기','article','user','pending','draft'),
 ('C-EDU-DM','disease_edu','당뇨와 소변검사','article','user','pending','draft'),
 ('C-EDU-HTN','disease_edu','고혈압과 신장 건강','article','user','pending','draft'),
 ('C-LIFE-KID','lifestyle','신장 건강 생활수칙','checklist','user','pending','draft'),
 ('C-LIFE-HYD','lifestyle','수분 관리 미션','checklist','user','pending','draft'),
 ('C-ACT-LOW','risk_action','양호 등급 행동지침','card','user','pending','draft'),
 ('C-ACT-MOD','risk_action','관찰 등급 행동지침','step_guide','user','pending','draft'),
 ('C-ACT-HI','risk_action','주의 등급 행동지침','step_guide','user','pending','draft'),
 ('C-ACT-VHI','risk_action','즉시확인 등급 행동지침','step_guide','user','pending','draft'),
 ('C-SAFE-01','safety','선별검사 한계 안내','card','user','pending','draft'),
 ('C-MOT-IMP','motivation','위험 개선 축하','card','user','pending','draft'),
 ('C-CLN-KID','clinician','신장 임상 요약 템플릿','clinical_report','clinician','pending','draft'),
 ('C-CARE-01','caregiver','보호자 알림 요약','card','caregiver','pending','draft')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 큐레이션 규칙 (9종)
-- ---------------------------------------------------------------------
INSERT INTO content_curation_rule (id, content_id, condition, priority, active) VALUES
 ('rule_first_measurement','C-ONB-01','{"first_time": true}'::jsonb,1,true),
 ('rule_protein_moderate','C-RX-PRO','{"disease":"kidney","risk_grade":["moderate"],"analyte_flags":{"protein":">=2"}}'::jsonb,10,true),
 ('rule_protein_high','C-ACT-HI','{"disease":"kidney","risk_grade":["high","very_high"]}'::jsonb,5,true),
 ('rule_glucose_positive','C-RX-GLU','{"analyte_flags":{"glucose":">=2"}}'::jsonb,12,true),
 ('rule_kidney_edu','C-EDU-KID','{"disease":"kidney","risk_grade":["moderate","high"]}'::jsonb,20,true),
 ('rule_uti_signal','C-RX-LEU','{"analyte_flags":{"leukocyte":">=2","nitrite":">=1"}}'::jsonb,8,true),
 ('rule_emergency','C-ACT-VHI','{"risk_grade":["very_high"]}'::jsonb,1,true),
 ('rule_risk_improved','C-MOT-IMP','{"risk_trend":"improved"}'::jsonb,15,true),
 ('rule_streak_7','C-MOT-IMP','{"streak_days":">=7"}'::jsonb,18,true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 알림 템플릿 (9종)
-- ---------------------------------------------------------------------
INSERT INTO notification_template (id, channel, title, body, variables) VALUES
 ('NT_RESULT_READY','push','검사 결과가 준비됐어요','{name}님, 이번 측정 결과를 확인해 보세요.','["name"]'::jsonb),
 ('NT_RECHECK_DUE','push','재측정할 시간이에요','추세 확인을 위해 다시 한 번 측정해 주세요.','[]'::jsonb),
 ('NT_RISK_MODERATE','push','결과를 확인해 주세요','{analyte} 수치가 평소보다 조금 높아요. 자세히 보기.','["analyte"]'::jsonb),
 ('NT_RISK_HIGH','sms','[건강알림] 결과 확인 필요','주의가 필요한 결과가 있어요. 앱에서 확인하고 재측정을 권합니다.','[]'::jsonb),
 ('NT_EMERGENCY','sms','[긴급] 즉시 확인 필요','즉시 확인이 필요한 결과입니다. 가능한 한 빨리 의료기관 방문을 권합니다.','[]'::jsonb),
 ('NT_CAREGIVER','kakao','[보호자 알림]','{patient}님의 최근 측정에서 확인이 필요한 결과가 있습니다.','["patient"]'::jsonb),
 ('NT_MISSION','inapp','오늘의 미션','오늘의 건강 미션 {count}개가 기다리고 있어요.','["count"]'::jsonb),
 ('NT_BADGE','inapp','뱃지 획득!','{badge} 뱃지를 얻었어요. 축하해요!','["badge"]'::jsonb),
 ('NT_STREAK','push','{days}일 연속 측정!','꾸준함이 건강을 만들어요. 계속 이어가 볼까요?','["days"]'::jsonb)
ON CONFLICT (id) DO NOTHING;
