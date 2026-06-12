-- =====================================================================
-- 0004_notification — 사용자 알림(인앱). 외부 채널(push/sms/kakao)은 발송 어댑터로 확장.
-- 참고: 세부개발데이터 E.3 알림 템플릿 / E.4 발송 정책
-- =====================================================================
CREATE TABLE IF NOT EXISTS care.notification (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES care.user_account(id) ON DELETE CASCADE,
    template_id VARCHAR(40),
    channel     VARCHAR(20) NOT NULL DEFAULT 'inapp',   -- inapp|push|sms|kakao
    category    VARCHAR(20) NOT NULL DEFAULT 'info',     -- info|result|risk|recheck|care
    title       VARCHAR(200) NOT NULL,
    body        TEXT NOT NULL,
    ref_type    VARCHAR(40),                              -- assessment|care_action|referral
    ref_id      VARCHAR(64),
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON care.notification (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON care.notification (user_id, read_at);
