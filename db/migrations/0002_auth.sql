-- =====================================================================
-- 0002_auth — 데모 인증용 컬럼 (이메일/비밀번호 해시/슈퍼 플래그)
-- 주의: 데모 등급 인증. 운영은 Supabase Auth(auth.users)로 교체.
-- =====================================================================
ALTER TABLE care.user_account ADD COLUMN IF NOT EXISTS email         VARCHAR(255);
ALTER TABLE care.user_account ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE care.user_account ADD COLUMN IF NOT EXISTS display_name  VARCHAR(80);
ALTER TABLE care.user_account ADD COLUMN IF NOT EXISTS is_super      BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email ON care.user_account (email) WHERE email IS NOT NULL;
