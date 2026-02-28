-- Add scores_included_in_leaderboard (head judge can exclude a judge from impacting results)
-- Add judge_type 'shadow' (judges in training; scores never count)
ALTER TABLE division_judges ADD COLUMN IF NOT EXISTS scores_included_in_leaderboard BOOLEAN DEFAULT true;

-- Extend judge_type to include 'shadow'
ALTER TABLE division_judges DROP CONSTRAINT IF EXISTS division_judges_judge_type_check;
ALTER TABLE division_judges ADD CONSTRAINT division_judges_judge_type_check
  CHECK (judge_type IN ('head', 'general', 'technical', 'performance', 'shadow'));
