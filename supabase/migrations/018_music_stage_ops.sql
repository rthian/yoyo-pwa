-- Prompt 11: Stage music operations extras
-- Rollback: ALTER TABLE music_submissions DROP COLUMN IF EXISTS backup_status, backup_checked_at;
--           ALTER TABLE music_submission_versions DROP COLUMN IF EXISTS display_filename;

ALTER TABLE music_submissions
  ADD COLUMN IF NOT EXISTS backup_status VARCHAR(20) NOT NULL DEFAULT 'unknown'
    CHECK (backup_status IN ('unknown', 'pending', 'cached', 'failed', 'stale')),
  ADD COLUMN IF NOT EXISTS backup_checked_at TIMESTAMPTZ;

ALTER TABLE music_submission_versions
  ADD COLUMN IF NOT EXISTS display_filename TEXT;
