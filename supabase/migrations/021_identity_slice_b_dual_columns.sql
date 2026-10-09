-- Prompt 2 Slice B: dual competitor_id columns (nullable) + backfill + dual-write trigger
-- Callers: registration RPC, division_members / division_results / ranking_points writers
-- Glob: no prior 021_*; Slice A = 011_competitors_identity.sql
-- Sample row after backfill: member_id=acct_demo, competitor_id=comp_demo
-- User: "yes"
-- Rollback: DROP TRIGGER/FUNCTION fill_*; ALTER TABLE … DROP COLUMN competitor_id;

-- ---------------------------------------------------------------------------
-- Add nullable competitor_id columns
-- ---------------------------------------------------------------------------
ALTER TABLE division_members
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES competitors(id) ON DELETE RESTRICT;

ALTER TABLE division_results
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES competitors(id) ON DELETE RESTRICT;

ALTER TABLE ranking_points
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES competitors(id) ON DELETE RESTRICT;

ALTER TABLE season_titles
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES competitors(id) ON DELETE RESTRICT;

ALTER TABLE member_privileges
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES competitors(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Backfill from source_member_id, then self-link
-- ---------------------------------------------------------------------------
UPDATE division_members dm
SET competitor_id = c.id
FROM competitors c
WHERE dm.competitor_id IS NULL
  AND c.source_member_id = dm.member_id;

UPDATE division_members dm
SET competitor_id = l.competitor_id
FROM account_competitor_links l
WHERE dm.competitor_id IS NULL
  AND l.account_id = dm.member_id
  AND l.relationship = 'self';

UPDATE division_results dr
SET competitor_id = c.id
FROM competitors c
WHERE dr.competitor_id IS NULL
  AND c.source_member_id = dr.member_id;

UPDATE division_results dr
SET competitor_id = l.competitor_id
FROM account_competitor_links l
WHERE dr.competitor_id IS NULL
  AND l.account_id = dr.member_id
  AND l.relationship = 'self';

UPDATE ranking_points rp
SET competitor_id = c.id
FROM competitors c
WHERE rp.competitor_id IS NULL
  AND c.source_member_id = rp.member_id;

UPDATE ranking_points rp
SET competitor_id = l.competitor_id
FROM account_competitor_links l
WHERE rp.competitor_id IS NULL
  AND l.account_id = rp.member_id
  AND l.relationship = 'self';

UPDATE season_titles st
SET competitor_id = c.id
FROM competitors c
WHERE st.competitor_id IS NULL
  AND c.source_member_id = st.member_id;

UPDATE season_titles st
SET competitor_id = l.competitor_id
FROM account_competitor_links l
WHERE st.competitor_id IS NULL
  AND l.account_id = st.member_id
  AND l.relationship = 'self';

UPDATE member_privileges mp
SET competitor_id = c.id
FROM competitors c
WHERE mp.competitor_id IS NULL
  AND c.source_member_id = mp.member_id;

UPDATE member_privileges mp
SET competitor_id = l.competitor_id
FROM account_competitor_links l
WHERE mp.competitor_id IS NULL
  AND l.account_id = mp.member_id
  AND l.relationship = 'self';

-- ---------------------------------------------------------------------------
-- Temporary uniqueness on (scope, competitor_id) when set
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_division_members_division_competitor
  ON division_members (division_id, competitor_id)
  WHERE competitor_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_division_results_division_competitor
  ON division_results (division_id, competitor_id)
  WHERE competitor_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_points_event_category_competitor
  ON ranking_points (event_id, category_id, competitor_id)
  WHERE competitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_division_members_competitor
  ON division_members (competitor_id);

CREATE INDEX IF NOT EXISTS idx_division_results_competitor
  ON division_results (competitor_id);

CREATE INDEX IF NOT EXISTS idx_ranking_points_competitor
  ON ranking_points (competitor_id);

CREATE INDEX IF NOT EXISTS idx_season_titles_competitor
  ON season_titles (competitor_id);

CREATE INDEX IF NOT EXISTS idx_member_privileges_competitor
  ON member_privileges (competitor_id);

-- ---------------------------------------------------------------------------
-- Dual-write trigger: fill competitor_id from member_id when omitted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fill_competitor_id_from_member()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.competitor_id IS NULL AND NEW.member_id IS NOT NULL THEN
    SELECT c.id INTO NEW.competitor_id
    FROM competitors c
    WHERE c.source_member_id = NEW.member_id;

    IF NEW.competitor_id IS NULL THEN
      SELECT l.competitor_id INTO NEW.competitor_id
      FROM account_competitor_links l
      WHERE l.account_id = NEW.member_id
        AND l.relationship = 'self'
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dm_fill_competitor ON division_members;
CREATE TRIGGER trg_dm_fill_competitor
  BEFORE INSERT OR UPDATE OF member_id, competitor_id ON division_members
  FOR EACH ROW EXECUTE FUNCTION fill_competitor_id_from_member();

DROP TRIGGER IF EXISTS trg_dr_fill_competitor ON division_results;
CREATE TRIGGER trg_dr_fill_competitor
  BEFORE INSERT OR UPDATE OF member_id, competitor_id ON division_results
  FOR EACH ROW EXECUTE FUNCTION fill_competitor_id_from_member();

DROP TRIGGER IF EXISTS trg_rp_fill_competitor ON ranking_points;
CREATE TRIGGER trg_rp_fill_competitor
  BEFORE INSERT OR UPDATE OF member_id, competitor_id ON ranking_points
  FOR EACH ROW EXECUTE FUNCTION fill_competitor_id_from_member();

DROP TRIGGER IF EXISTS trg_st_fill_competitor ON season_titles;
CREATE TRIGGER trg_st_fill_competitor
  BEFORE INSERT OR UPDATE OF member_id, competitor_id ON season_titles
  FOR EACH ROW EXECUTE FUNCTION fill_competitor_id_from_member();

DROP TRIGGER IF EXISTS trg_mp_fill_competitor ON member_privileges;
CREATE TRIGGER trg_mp_fill_competitor
  BEFORE INSERT OR UPDATE OF member_id, competitor_id ON member_privileges
  FOR EACH ROW EXECUTE FUNCTION fill_competitor_id_from_member();

-- ---------------------------------------------------------------------------
-- Registration confirm: dual-write competitor_id into division_members
-- (preserves 014 confirm_or_waitlist behaviour; adds competitor_id)
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

  IF v_new_status = 'confirmed' AND v_member_id IS NOT NULL THEN
    INSERT INTO division_members (division_id, member_id, competitor_id, status)
    VALUES (v_entry.division_id, v_member_id, v_reg.competitor_id, 'registered')
    ON CONFLICT (division_id, member_id) DO UPDATE
      SET status = EXCLUDED.status,
          competitor_id = COALESCE(EXCLUDED.competitor_id, division_members.competitor_id),
          updated_at = NOW()
    RETURNING id INTO v_dm_id;

    IF v_dm_id IS NULL THEN
      SELECT id INTO v_dm_id
      FROM division_members
      WHERE division_id = v_entry.division_id AND member_id = v_member_id;
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

COMMENT ON COLUMN division_members.competitor_id IS
  'Slice B dual key; member_id remains required until Slice D';
COMMENT ON COLUMN division_results.competitor_id IS
  'Slice B dual key; member_id remains required until Slice D';
COMMENT ON COLUMN ranking_points.competitor_id IS
  'Slice B dual key; member_id remains required until Slice D';
