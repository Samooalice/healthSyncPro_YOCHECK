-- 0005_content_payload — 형식별 구조화 데이터(아티클 섹션·퀴즈 문항·체크리스트 미션).
ALTER TABLE care.content ADD COLUMN IF NOT EXISTS payload JSONB;
