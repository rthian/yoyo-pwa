-- Prompt 2 Slice D1: require competitor_id; keep member_id nullable (D2 drops member_id).
-- Callers: registration RPC, standings/finalize upserts, enrollment writers
-- Glob: no prior 022_*; requires 021 applied + backfill complete
-- Sample: division_members { competitor_id: "comp_demo" NOT NULL, member_id: "acct_demo"|null }
-- User: "next"
-- Rollback: new migration restoring member_id NOT NULL + old uniques (do not rewrite 022).

-- ---------------------------------------------------------------------------
-- Final backfill pass
-- ---------------------------------------------------------------------------
UPDATE division_members dm
SET competitor_id = c.id
FROM competitors c
WHERE dm.competitor_id IS NULL AND c.source_member_id = dm.member_id;

UPDATE division_members dm
SET competitor_id = l.competitor_id
FROM account_competitor_links l
WHERE dm.competitor_id IS NULL
  AND l.account_id = dm.member_id
  AND l.relationship = 'self';

UPDATE division_results dr
SET competitor_id = c.id
FROM competitors c
WHERE dr.competitor_id IS NULL AND c.source_member_id = dr.member_id;

UPDATE division_results dr
SET competitor_id = l.competitor_id
FROM account_competitor_links l
WHERE dr.competitor_id IS NULL
  AND l.account_id = dr.member_id
  AND l.relationship = 'self';

UPDATE ranking_points rp
SET competitor_id = c.id
FROM competitors c
WHERE rp.competitor_id IS NULL AND c.source_member_id = rp.member_id;

UPDATE ranking_points rp
SET competitor_id = l.competitor_id
FROM account_competitor_links l
WHERE rp.competitor_id IS NULL
  AND l.account_id = rp.member_id
  AND l.relationship = 'self';

UPDATE season_titles st
SET competitor_id = c.id
FROM competitors c
WHERE st.competitor_id IS NULL AND c.source_member_id = st.member_id;

UPDATE season_titles st
SET competitor_id = l.competitor_id
FROM account_competitor_links l
WHERE st.competitor_id IS NULL
  AND l.account_id = st.member_id
  AND l.relationship = 'self';

UPDATE member_privileges mp
SET competitor_id = c.id
FROM competitors c
WHERE mp.competitor_id IS NULL AND c.source_member_id = mp.member_id;

UPDATE member_privileges mp
SET competitor_id = l.competitor_id
FROM account_competitor_links l
WHERE mp.competitor_id IS NULL
  AND l.account_id = mp.member_id
  AND l.relationship = 'self';

-- ---------------------------------------------------------------------------
-- Preflight: refuse NOT NULL if any competitor_id still missing
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM division_members WHERE competitor_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Slice D1 blocked: % division_members rows missing competitor_id', n;
  END IF;
  SELECT COUNT(*) INTO n FROM division_results WHERE competitor_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Slice D1 blocked: % division_results rows missing competitor_id', n;
  END IF;
  SELECT COUNT(*) INTO n FROM ranking_points WHERE competitor_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Slice D1 blocked: % ranking_points rows missing competitor_id', n;
  END IF;
  SELECT COUNT(*) INTO n FROM season_titles WHERE competitor_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Slice D1 blocked: % season_titles rows missing competitor_id', n;
  END IF;
  SELECT COUNT(*) INTO n FROM member_privileges WHERE competitor_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Slice D1 blocked: % member_privileges rows missing competitor_id', n;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Drop Slice B partial uniques; promote full competitor uniqueness
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_division_members_division_competitor;
DROP INDEX IF EXISTS idx_division_results_division_competitor;
DROP INDEX IF EXISTS idx_ranking_points_event_category_competitor;

ALTER TABLE division_members ALTER COLUMN competitor_id SET NOT NULL;
ALTER TABLE division_results ALTER COLUMN competitor_id SET NOT NULL;
ALTER TABLE ranking_points ALTER COLUMN competitor_id SET NOT NULL;
ALTER TABLE season_titles ALTER COLUMN competitor_id SET NOT NULL;
ALTER TABLE member_privileges ALTER COLUMN competitor_id SET NOT NULL;

ALTER TABLE division_members ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE division_results ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE ranking_points ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE season_titles ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE member_privileges ALTER COLUMN member_id DROP NOT NULL;

-- Drop legacy unique constraints on (…, member_id)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    WHERE c.contype = 'u'
      AND c.conrelid::regclass::text IN (
        'division_members', 'division_results', 'ranking_points'
      )
      AND pg_get_constraintdef(c.oid) ILIKE '%member_id%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_division_members_division_competitor
  ON division_members (division_id, competitor_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_division_results_division_competitor
  ON division_results (division_id, competitor_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_points_event_category_competitor
  ON ranking_points (event_id, category_id, competitor_id);

CREATE INDEX IF NOT EXISTS idx_division_members_member
  ON division_members (member_id);

CREATE INDEX IF NOT EXISTS idx_division_results_member
  ON division_results (member_id);

CREATE INDEX IF NOT EXISTS idx_ranking_points_member
  ON ranking_points (member_id, season_id);

-- ---------------------------------------------------------------------------
-- Registration confirm: upsert on (division_id, competitor_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirm_or_waitlist_registration_entry(
  p_entry_id UUID,
  p_actor_id UUID DEFAULT NULL
)
RETURNS registration_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry registration_entries;
  v_reg registrations;
  v_division divisions;
  v_confirmed_count INTEGER;
  v_new_status TEXT;
  v_waitlist_pos INTEGER;
  v_member_id UUID;
  v_dm_id UUID;
BEGIN
  SELECT re.* INTO v_entry
  FROM registration_entries re
  WHERE re.id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration entry not found';
  END IF;

  SELECT r.* INTO v_reg
  FROM registrations r
  WHERE r.id = v_entry.registration_id
  FOR UPDATE;

  SELECT d.* INTO v_division
  FROM divisions d
  WHERE d.id = v_entry.division_id
  FOR UPDATE;

  IF v_division.event_id <> v_reg.event_id THEN
    RAISE EXCEPTION 'division does not belong to registration event';
  END IF;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM registration_entries re
  WHERE re.division_id = v_entry.division_id
    AND re.status IN ('confirmed', 'checked_in')
    AND re.id <> v_entry.id;

  IF v_division.capacity IS NOT NULL AND v_confirmed_count >= v_division.capacity THEN
    IF COALESCE(v_division.waitlist_enabled, true) THEN
      v_new_status := 'waitlisted';
      SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_waitlist_pos
      FROM registration_entries
      WHERE division_id = v_entry.division_id
        AND status = 'waitlisted';
    ELSE
      RAISE EXCEPTION 'division at capacity';
    END IF;
  ELSE
    v_new_status := 'confirmed';
    v_waitlist_pos := NULL;
  END IF;

  SELECT c.source_member_id INTO v_member_id
  FROM competitors c
  WHERE c.id = v_reg.competitor_id;

  IF v_member_id IS NULL THEN
    SELECT l.account_id INTO v_member_id
    FROM account_competitor_links l
    WHERE l.competitor_id = v_reg.competitor_id
      AND l.relationship = 'self'
    LIMIT 1;
  END IF;

  IF v_new_status = 'confirmed' THEN
    INSERT INTO division_members (division_id, member_id, competitor_id, status)
    VALUES (v_entry.division_id, v_member_id, v_reg.competitor_id, 'registered')
    ON CONFLICT (division_id, competitor_id) DO UPDATE
      SET status = EXCLUDED.status,
          member_id = COALESCE(EXCLUDED.member_id, division_members.member_id),
          updated_at = NOW()
    RETURNING id INTO v_dm_id;

    IF v_dm_id IS NULL THEN
      SELECT id INTO v_dm_id
      FROM division_members
      WHERE division_id = v_entry.division_id
        AND competitor_id = v_reg.competitor_id;
    END IF;
  END IF;

  UPDATE registration_entries
  SET status = v_new_status,
      waitlist_position = v_waitlist_pos,
      division_member_id = CASE WHEN v_new_status = 'confirmed' THEN v_dm_id ELSE division_member_id END,
      updated_at = NOW()
  WHERE id = v_entry.id
  RETURNING * INTO v_entry;

  IF EXISTS (
    SELECT 1 FROM registration_entries
    WHERE registration_id = v_reg.id AND status = 'confirmed'
  ) THEN
    UPDATE registrations SET status = 'confirmed', updated_at = NOW() WHERE id = v_reg.id;
  ELSIF EXISTS (
    SELECT 1 FROM registration_entries
    WHERE registration_id = v_reg.id AND status = 'waitlisted'
  ) AND NOT EXISTS (
    SELECT 1 FROM registration_entries
    WHERE registration_id = v_reg.id AND status IN ('confirmed', 'checked_in')
  ) THEN
    UPDATE registrations SET status = 'waitlisted', updated_at = NOW() WHERE id = v_reg.id;
  END IF;

  INSERT INTO registration_audit_events (
    registration_id, registration_entry_id, actor_account_id, action, from_status, to_status, detail
  ) VALUES (
    v_reg.id, v_entry.id, p_actor_id, 'confirm_or_waitlist',
    NULL, v_new_status,
    jsonb_build_object(
      'confirmed_count', v_confirmed_count,
      'capacity', v_division.capacity,
      'waitlist_position', v_waitlist_pos
    )
  );

  RETURN v_entry;
END;
$$;

-- ---------------------------------------------------------------------------
-- public_competitors view (Slice D); keep public_members for compatibility
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_competitors AS
SELECT
  id,
  public_id,
  full_name,
  nickname,
  avatar_url,
  country,
  home_geo_id,
  gender,
  first_competed_on,
  bio,
  created_at
FROM competitors
WHERE is_active = true
  AND profile_visibility = 'public';

COMMENT ON VIEW public_competitors IS
  'Slice D1 public competitor projection; prefer over public_members for new code';

COMMENT ON COLUMN division_members.competitor_id IS
  'Slice D1 required competition identity; member_id nullable until D2';
COMMENT ON COLUMN division_members.member_id IS
  'Slice D1 nullable Auth bridge; dropped in Slice D2';
