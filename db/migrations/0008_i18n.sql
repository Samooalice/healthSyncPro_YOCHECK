-- 0008_i18n — DB 콘텐츠 다국어
--
-- 화면 문구(UI)는 web/messages/*.json 카탈로그가 담당한다.
-- DB 에 저장되는 "콘텐츠 본문"만 여기서 언어별 행으로 관리한다.
-- 기준어(ko)는 기존 care.content 에 그대로 두고, 번역만 얹는다.
-- 번역 행이 없으면 화면은 ko 로 폴백한다(빈 화면 방지).
--
-- 알림(care.notification / notification_template)은 이 테이블을 쓰지 않는다.
--   · 알림 문구의 다국어는 카탈로그(notify.*)가 담당하고, 알림함이 template_id 로
--     현재 언어에서 다시 렌더한다 (web/src/lib/care/notifyRender.ts).
--   · care.notification_template 은 "운영자가 DB에서 고치는 기준어(ko) 오버라이드"로 남긴다.
--     언어별 오버라이드가 필요해지면 locale 컬럼 추가 + 기본키를 (id, locale) 로 바꾸는
--     후속 마이그레이션이 필요하다(Prisma 모델 재생성 동반).

CREATE TABLE IF NOT EXISTS care.content_i18n (
    content_id  VARCHAR(40) NOT NULL REFERENCES care.content(id) ON DELETE CASCADE,
    locale      VARCHAR(10) NOT NULL,          -- en | ja | vi | zh-Hans | zh-Hant
    title       VARCHAR(200) NOT NULL,
    body        TEXT,
    payload     JSONB,                          -- 아티클 섹션·퀴즈·체크리스트(구조 동일, 문구만 번역)
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (content_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_content_i18n_locale ON care.content_i18n(locale);

COMMENT ON TABLE care.content_i18n IS
  '콘텐츠 번역. 기준어(ko)는 care.content 본체에 있고 여기에는 번역만 둔다. 없으면 ko 폴백.';
