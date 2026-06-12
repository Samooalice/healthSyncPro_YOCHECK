-- =====================================================================
-- 0007_mission — 일일 미션 완료 로그 (게이미피케이션 P5/7.7)
-- gamification_state(points/streak_days/badges/goals)는 0001에 존재.
-- 일일 미션은 (user, mission_key, 날짜) 단위로 멱등 기록한다.
-- =====================================================================
CREATE TABLE IF NOT EXISTS care.mission_log (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES care.user_account(id) ON DELETE CASCADE,
    mission_key  VARCHAR(40) NOT NULL,
    mission_date DATE NOT NULL,
    points       INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, mission_key, mission_date)
);

CREATE INDEX IF NOT EXISTS idx_mission_user_date ON care.mission_log (user_id, mission_date DESC);
