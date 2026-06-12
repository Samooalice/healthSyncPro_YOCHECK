-- =====================================================================
-- 0006_clinician — 의료진 가입 프로필 + 승인(자격검증) 게이트
-- 의료진 계정은 환자 PHI에 접근하므로 가입 즉시 활성화하지 않고
-- 관리자 승인(verified) 후 status='active'로 전환한다. (규제 12장·보안 13장)
-- =====================================================================
CREATE TABLE IF NOT EXISTS care.clinician_profile (
    user_id       UUID PRIMARY KEY REFERENCES care.user_account(id) ON DELETE CASCADE,
    license_type  VARCHAR(20) NOT NULL CHECK (license_type IN ('doctor','nurse','medtech')),
    license_no    VARCHAR(60),                 -- 데모: 평문(운영 시 KMS 암호화·마스킹 저장)
    organization  VARCHAR(120),                -- 소속 의료기관
    department    VARCHAR(60),                 -- 진료과(선택)
    verified      BOOLEAN NOT NULL DEFAULT false,
    verified_by   UUID,                        -- 승인한 관리자 user_account.id
    verified_at   TIMESTAMPTZ,
    reject_reason TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 의료진 계정의 초기 상태는 'pending'(승인 대기). 기존 시드 의료진은 영향 없음.
-- (care.user_account.status 는 0001에서 default 'active' — 가입 액션에서 'pending' 명시)
