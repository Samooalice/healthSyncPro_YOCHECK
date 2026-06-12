-- =====================================================================
-- 만성질환 관리 통합플랫폼 — DB 마이그레이션
-- 대상: PostgreSQL 16 + TimescaleDB
-- 실행 순서대로 번호 부여. 각 블록은 멱등(IF NOT EXISTS) 지향.
-- 주의: 운영 적용 전 법무·보안 검토(암호화·RLS) 필수.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 001_extensions
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE SCHEMA IF NOT EXISTS secure;

-- ---------------------------------------------------------------------
-- 002_account
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_account (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pseudo_id       VARCHAR(64) UNIQUE NOT NULL,
    account_type    VARCHAR(20) NOT NULL CHECK (account_type IN ('b2c','facility','clinician','admin')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    locale          VARCHAR(10) DEFAULT 'ko-KR',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS secure.user_pii (
    user_id         UUID PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
    name_enc        BYTEA,
    phone_enc       BYTEA,
    birth_year      SMALLINT,
    sex             CHAR(1) CHECK (sex IN ('M','F','O')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    consent_type    VARCHAR(40) NOT NULL,
    granted         BOOLEAN NOT NULL,
    version         VARCHAR(20) NOT NULL,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 003_device_measurement
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    device_model    VARCHAR(80) NOT NULL,
    serial_enc      BYTEA,
    calibration     JSONB,
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS measurement (
    id               UUID DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    device_id        UUID REFERENCES device(id),
    measured_at      TIMESTAMPTZ NOT NULL,
    source           VARCHAR(20) NOT NULL CHECK (source IN ('analyzer','camera')),
    glucose          NUMERIC,
    protein          NUMERIC,
    ph               NUMERIC,
    specific_gravity NUMERIC,
    ketone           NUMERIC,
    blood            NUMERIC,
    leukocyte        NUMERIC,
    nitrite          NUMERIC,
    urobilinogen     NUMERIC,
    bilirubin        NUMERIC,
    vitamin_c        NUMERIC,
    raw_image_url    TEXT,
    meta             JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, measured_at)
);
SELECT create_hypertable('measurement', 'measured_at', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS correction (
    measurement_id  UUID NOT NULL,
    measured_at     TIMESTAMPTZ NOT NULL,
    corrected       JSONB NOT NULL,
    confidence_wt   JSONB NOT NULL,
    sg_normalized   BOOLEAN DEFAULT false,
    vitc_flag       BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (measurement_id, measured_at)
);

-- ---------------------------------------------------------------------
-- 004_baseline_assessment
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS baseline (
    user_id     UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    analyte     VARCHAR(30) NOT NULL,
    mean        NUMERIC NOT NULL,
    sd          NUMERIC NOT NULL,
    cv          NUMERIC,
    n_samples   INT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, analyte)
);

CREATE TABLE IF NOT EXISTS risk_assessment (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    measurement_id  UUID NOT NULL,
    disease         VARCHAR(30) NOT NULL,
    risk_score      NUMERIC NOT NULL,
    risk_grade      VARCHAR(20) NOT NULL,
    standard_grade  VARCHAR(20),
    model_version   VARCHAR(40) NOT NULL,
    is_samd_output  BOOLEAN DEFAULT true,
    assessed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS explanation (
    assessment_id   UUID PRIMARY KEY REFERENCES risk_assessment(id) ON DELETE CASCADE,
    shap_values     JSONB NOT NULL,
    text_user       TEXT NOT NULL,
    text_clinician  TEXT NOT NULL,
    counterfactual  JSONB,
    report_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 005_careloop
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS care_action (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    assessment_id   UUID REFERENCES risk_assessment(id),
    action_type     VARCHAR(40) NOT NULL,
    grade_trigger   VARCHAR(20),
    payload         JSONB,
    status          VARCHAR(20) DEFAULT 'assigned',
    due_at          TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    assessment_id   UUID REFERENCES risk_assessment(id),
    report_url      TEXT,
    clinic_id       UUID,
    status          VARCHAR(20) DEFAULT 'created',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_label (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    assessment_id   UUID REFERENCES risk_assessment(id),
    label_type      VARCHAR(30) NOT NULL,
    label_value     JSONB NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 006_content_cms
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content (
    id              VARCHAR(40) PRIMARY KEY,
    category        VARCHAR(40) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    format          VARCHAR(20),
    audience        VARCHAR(20) NOT NULL,
    medical_review  VARCHAR(20) DEFAULT 'pending',
    reviewer_id     UUID,
    source_refs     JSONB,
    status          VARCHAR(20) DEFAULT 'draft',
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_curation_rule (
    id          VARCHAR(40) PRIMARY KEY,
    content_id  VARCHAR(40) NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    condition   JSONB NOT NULL,
    priority    INT DEFAULT 100,
    active      BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_content_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    content_id  VARCHAR(40) NOT NULL,
    event       VARCHAR(30) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 007_gamification_notification
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gamification_state (
    user_id     UUID PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
    points      INT DEFAULT 0,
    streak_days INT DEFAULT 0,
    badges      JSONB DEFAULT '[]',
    goals       JSONB DEFAULT '[]',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_template (
    id          VARCHAR(40) PRIMARY KEY,
    channel     VARCHAR(20) NOT NULL,
    title       VARCHAR(200),
    body        TEXT NOT NULL,
    variables   JSONB DEFAULT '[]',
    active      BOOLEAN DEFAULT true
);

-- ---------------------------------------------------------------------
-- 008_audit
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    UUID,
    action      VARCHAR(60) NOT NULL,
    target      VARCHAR(120),
    ip          INET,
    detail      JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 009_indexes
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meas_user_time      ON measurement (user_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_assess_user_time    ON risk_assessment (user_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_assess_disease_grade ON risk_assessment (disease, risk_grade);
CREATE INDEX IF NOT EXISTS idx_care_user_status    ON care_action (user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_cat_status  ON content (category, status);
CREATE INDEX IF NOT EXISTS idx_curation_active     ON content_curation_rule (active, priority);
CREATE INDEX IF NOT EXISTS idx_ucl_user            ON user_content_log (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor_time    ON audit_log (actor_id, occurred_at DESC);

-- ---------------------------------------------------------------------
-- 010_rls (행 수준 보안 — 예시; 운영 적용 전 보안검토 필수)
-- ---------------------------------------------------------------------
ALTER TABLE measurement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meas_owner ON measurement;
CREATE POLICY meas_owner ON measurement
    USING (user_id = current_setting('app.user_id', true)::uuid);

ALTER TABLE risk_assessment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assess_owner ON risk_assessment;
CREATE POLICY assess_owner ON risk_assessment
    USING (user_id = current_setting('app.user_id', true)::uuid);

-- 의료진의 담당 환자 접근은 별도 매핑 테이블 조인 정책으로 확장(추후).
