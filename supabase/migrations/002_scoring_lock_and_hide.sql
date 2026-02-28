-- Add scoring_locked and hide_scores_until_complete to divisions
ALTER TABLE divisions ADD COLUMN IF NOT EXISTS scoring_locked BOOLEAN DEFAULT false;
ALTER TABLE divisions ADD COLUMN IF NOT EXISTS hide_scores_until_complete BOOLEAN DEFAULT false;
