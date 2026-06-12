-- =====================================================================
-- 0003_phr — 마이헬스데이터(나의건강기록 FHIR PHR) 저장
-- 출처: sdc_deploy yocheck_analytics PhrRecord. 1인 1레코드(최신 요약).
-- =====================================================================
CREATE TABLE IF NOT EXISTS care.phr_record (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES care.user_account(id) ON DELETE CASCADE,
    source        VARCHAR(40) DEFAULT 'myhealthway',
    subject_name  VARCHAR(80),
    report_date   DATE,
    summary       JSONB NOT NULL,   -- parse_phr 결과(검진·복약·진단·접종)
    flags         JSONB NOT NULL,   -- 만성질환 플래그(diabetes/hypertension/...)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_phr_user ON care.phr_record (user_id);
