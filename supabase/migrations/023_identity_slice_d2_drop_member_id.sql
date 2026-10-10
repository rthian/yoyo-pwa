-- Prompt 2 Slice D2: drop member_id from competition dual-key tables.
-- Callers: schema cut after app embed/filter cutover (leaderboard, judge pages, my-events)
-- Glob: no prior 023_*; requires 022 + deployed competitor_id-only app code
-- Sample after: division_members { competitor_id: "comp_demo" } — no member_id column
-- User: "next"
-- Rollback: forward-only; restore columns from backup via a new migration if needed.

-- ---------------------------------------------------------------------------
-- Drop fill triggers that reference NEW.member_id
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_dm_fill_competitor ON division_members;
DROP TRIGGER IF EXISTS trg_dr_fill_competitor ON division_results;
DROP TRIGGER IF EXISTS trg_rp_fill_competitor ON ranking_points;
DROP TRIGGER IF EXISTS trg_st_fill_competitor ON season_titles;
DROP TRIGGER IF EXISTS trg_mp_fill_competitor ON member_privileges;
DROP FUNCTION IF EXISTS fill_competitor_id_from_member();

-- ---------------------------------------------------------------------------
-- Registration confirm: competitor_id only on division_members
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

  IF v_new_status = 'confirmed' THEN
    INSERT INTO division_members (division_id, competitor_id, status)
    VALUES (v_entry.division_id, v_reg.competitor_id, 'registered')
    ON CONFLICT (division_id, competitor_id) DO UPDATE
      SET status = EXCLUDED.status,
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
-- Leaderboard helper: join competitors
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_division_leaderboard(p_division_id UUID)
RETURNS TABLE (
  competitor_id UUID,
  member_name VARCHAR,
  avg_technical DECIMAL,
  avg_performance DECIMAL,
  total_score DECIMAL,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dm.competitor_id,
    c.full_name as member_name,
    ROUND(AVG(s.technical_score), 2) as avg_technical,
    ROUND(AVG(s.performance_score), 2) as avg_performance,
    ROUND(AVG(s.total_score), 2) as total_score,
    RANK() OVER (ORDER BY AVG(s.total_score) DESC) as rank
  FROM division_members dm
  JOIN competitors c ON c.id = dm.competitor_id
  LEFT JOIN scores s ON s.division_member_id = dm.id AND s.is_submitted = true
  WHERE dm.division_id = p_division_id
  GROUP BY dm.competitor_id, c.full_name
  ORDER BY total_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Drop legacy member indexes + columns
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_division_members_member;
DROP INDEX IF EXISTS idx_division_results_member;
DROP INDEX IF EXISTS idx_ranking_points_member;
DROP INDEX IF EXISTS idx_season_titles_member;
DROP INDEX IF EXISTS idx_member_privileges_member;

ALTER TABLE division_members DROP COLUMN IF EXISTS member_id;
ALTER TABLE division_results DROP COLUMN IF EXISTS member_id;
ALTER TABLE ranking_points DROP COLUMN IF EXISTS member_id;
ALTER TABLE season_titles DROP COLUMN IF EXISTS member_id;
ALTER TABLE member_privileges DROP COLUMN IF EXISTS member_id;

COMMENT ON COLUMN division_members.competitor_id IS
  'Slice D2: sole competition identity FK (member_id dropped)';
