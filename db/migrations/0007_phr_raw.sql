-- =====================================================================
-- 0007_phr_raw — PHR 원본 FHIR 리소스 배열(raw) 저장 컬럼
-- 출처: sdc_deploy yocheck_analytics PhrRecord.raw. 다중 파일 누적 병합을 위해
--   원본 리소스 배열을 보관한다(다음 업로드 시 기존 raw + 신규 → 중복제거 → 재파싱).
-- =====================================================================
ALTER TABLE care.phr_record ADD COLUMN IF NOT EXISTS raw JSONB;
