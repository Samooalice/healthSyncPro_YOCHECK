-- =====================================================================
-- 0009_care_team — 의료진 ↔ 환자 연결(담당 관계)
-- 개인(b2c) 가입자는 기본적으로 어떤 의료진과도 연결되지 않는다.
-- 의료진 포털(환자 목록·상세·리포트·대리측정)은 이 테이블로 연결된 환자만 접근한다.
-- (관리자/슈퍼 계정은 운영 감독 목적으로 전체 조회 — 접근은 audit_log 로 기록)
-- =====================================================================
CREATE TABLE IF NOT EXISTS care.clinician_patient (
    clinician_id UUID NOT NULL REFERENCES care.user_account(id) ON DELETE CASCADE,
    patient_id   UUID NOT NULL REFERENCES care.user_account(id) ON DELETE CASCADE,
    source       VARCHAR(20) NOT NULL DEFAULT 'registered'
                 CHECK (source IN ('registered','seed','invite')),  -- 의료진 등록 / 시드 / (향후) 환자 초대 수락
    linked_by    UUID REFERENCES care.user_account(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (clinician_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_clinician_patient_patient ON care.clinician_patient(patient_id);

COMMENT ON TABLE care.clinician_patient IS
  '의료진-환자 담당 관계. 의료진 포털은 연결된 환자만 조회·측정할 수 있다.';

-- 데모: 데모 의료진(clinician-001, 김민수)에 데모 환자 3명만 연결. 일반 가입자는 연결하지 않는다.
INSERT INTO care.clinician_patient (clinician_id, patient_id, source)
SELECT c.id, p.id, 'seed'
FROM care.user_account c
JOIN care.user_account p
  ON p.pseudo_id IN ('yc-2024q4-1334-e5', 'yc-2024q4-1334-e4', 'yc-2024q4-1334-e3')
WHERE c.pseudo_id = 'clinician-001'
ON CONFLICT DO NOTHING;
