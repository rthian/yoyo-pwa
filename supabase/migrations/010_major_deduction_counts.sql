-- Major deductions as separate counters (IYYF Worlds sheet: Stop / Discard / Cut)
-- Applied by: lib/judge/score-math.ts, ScoringForm, app/api/scores
-- Fields: md_stop_count (−1 ea), md_discard_count (−3), md_detach_count (−5)
-- User: "yes" (align to WYYC sheet)
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS md_stop_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS md_discard_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS md_detach_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN scores.md_stop_count IS 'Yo-yo stop/restart major deductions (−1 each)';
COMMENT ON COLUMN scores.md_discard_count IS 'Yo-yo discard/change major deductions (−3 each)';
COMMENT ON COLUMN scores.md_detach_count IS 'Yo-yo detach/string cut major deductions (−5 each)';
