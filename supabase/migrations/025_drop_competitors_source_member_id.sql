-- Identity cleanup: drop competitors.source_member_id (Slice A bridge).
-- Requires self links on account_competitor_links for every account-backed competitor.
-- Rollback: re-add UUID column + backfill from links where relationship = 'self'.

INSERT INTO account_competitor_links (
  account_id,
  competitor_id,
  relationship,
  can_register,
  can_manage_music,
  can_manage_profile,
  granted_by
)
SELECT
  c.source_member_id,
  c.id,
  'self',
  true,
  true,
  true,
  c.source_member_id
FROM competitors c
WHERE c.source_member_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM account_competitor_links l
    WHERE l.account_id = c.source_member_id
      AND l.competitor_id = c.id
  )
ON CONFLICT (account_id, competitor_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM competitors c
    WHERE c.source_member_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM account_competitor_links l
        WHERE l.competitor_id = c.id
          AND l.relationship = 'self'
          AND l.account_id = c.source_member_id
      )
  ) THEN
    RAISE EXCEPTION 'competitors with source_member_id missing self link — fix before drop';
  END IF;
END $$;

ALTER TABLE competitors DROP COLUMN IF EXISTS source_member_id;
