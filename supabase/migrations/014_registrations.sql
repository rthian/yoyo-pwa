-- Prompt 5: Registration aggregate (additive; keep division_members)
-- Confirmed entries sync into division_members (member_id bridge via competitors).
-- Rollback: DROP TABLE registration_audit_events, registration_entries, registrations;
--           ALTER TABLE divisions DROP COLUMN IF EXISTS capacity, DROP COLUMN IF EXISTS waitlist_enabled;

ALTER TABLE divisions
  ADD COLUMN IF NOT EXISTS capacity INTEGER
    CHECK (capacity IS NULL OR capacity > 0),
  ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- registrations: one competitor per event
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE RESTRICT,
  submitted_by_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'pending', 'confirmed', 'waitlisted',
      'cancelled', 'rejected', 'checked_in'
    )),
  eligibility_status VARCHAR(20) NOT NULL DEFAULT 'not_reviewed'
    CHECK (eligibility_status IN (
      'not_reviewed', 'pending', 'eligible', 'ineligible', 'needs_info'
    )),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN (
      'not_required', 'unpaid', 'pending', 'paid', 'waived', 'refunded'
    )),
  waiver_status VARCHAR(20) NOT NULL DEFAULT 'not_required'
    CHECK (waiver_status IN (
      'not_required', 'pending', 'signed', 'declined'
    )),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, competitor_id)
);

CREATE INDEX IF NOT EXISTS idx_registrations_event_status
  ON registrations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_competitor
  ON registrations(competitor_id);

DROP TRIGGER IF EXISTS update_registrations_updated_at ON registrations;
CREATE TRIGGER update_registrations_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- registration_entries: stages/divisions within a registration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registration_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'pending', 'confirmed', 'waitlisted',
      'cancelled', 'rejected', 'checked_in'
    )),
  waitlist_position INTEGER,
  division_member_id UUID REFERENCES division_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registration_id, division_id)
);

CREATE INDEX IF NOT EXISTS idx_registration_entries_division_status
  ON registration_entries(division_id, status);
CREATE INDEX IF NOT EXISTS idx_registration_entries_registration
  ON registration_entries(registration_id);

DROP TRIGGER IF EXISTS update_registration_entries_updated_at ON registration_entries;
CREATE TRIGGER update_registration_entries_updated_at
  BEFORE UPDATE ON registration_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- registration_audit_events (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registration_audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  registration_entry_id UUID REFERENCES registration_entries(id) ON DELETE SET NULL,
  actor_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  from_status VARCHAR(20),
  to_status VARCHAR(20),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_audit_registration
  ON registration_audit_events(registration_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Atomic confirm-or-waitlist for one entry (serializes on division row)
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

  -- Lock division row to serialize capacity decisions
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

  -- Resolve legacy member_id for division_members sync
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
    INSERT INTO division_members (division_id, member_id, status)
    VALUES (v_entry.division_id, v_member_id, 'registered')
    ON CONFLICT (division_id, member_id) DO UPDATE
      SET status = EXCLUDED.status,
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

  -- Roll up registration status
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
-- Backfill: existing division_members → confirmed registrations + entries
-- ---------------------------------------------------------------------------
INSERT INTO registrations (
  event_id, competitor_id, submitted_by_account_id, status, eligibility_status, payment_status, waiver_status
)
SELECT DISTINCT
  d.event_id,
  c.id,
  dm.member_id,
  'confirmed',
  'eligible',
  'not_required',
  'not_required'
FROM division_members dm
JOIN divisions d ON d.id = dm.division_id
JOIN competitors c ON c.source_member_id = dm.member_id
ON CONFLICT (event_id, competitor_id) DO NOTHING;

INSERT INTO registration_entries (
  registration_id, division_id, status, division_member_id
)
SELECT
  r.id,
  dm.division_id,
  'confirmed',
  dm.id
FROM division_members dm
JOIN divisions d ON d.id = dm.division_id
JOIN competitors c ON c.source_member_id = dm.member_id
JOIN registrations r
  ON r.event_id = d.event_id AND r.competitor_id = c.id
ON CONFLICT (registration_id, division_id) DO NOTHING;

INSERT INTO registration_audit_events (registration_id, action, to_status, detail)
SELECT r.id, 'backfill_from_division_members', 'confirmed', jsonb_build_object('source', 'division_members')
FROM registrations r
WHERE NOT EXISTS (
  SELECT 1 FROM registration_audit_events a
  WHERE a.registration_id = r.id AND a.action = 'backfill_from_division_members'
);

-- ---------------------------------------------------------------------------
-- RLS (mutations via service role after server auth in Slice 1 of Prompt 5)
-- ---------------------------------------------------------------------------
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Registrations select linked or admin" ON registrations;
CREATE POLICY "Registrations select linked or admin"
  ON registrations FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR account_manages_competitor(competitor_id, 'any')
    OR has_event_capability(event_id, 'view_ops')
  );

DROP POLICY IF EXISTS "Registrations admin manage" ON registrations;
CREATE POLICY "Registrations admin manage"
  ON registrations FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Registration entries select" ON registration_entries;
CREATE POLICY "Registration entries select"
  ON registration_entries FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.id = registration_id
        AND (
          account_manages_competitor(r.competitor_id, 'any')
          OR has_event_capability(r.event_id, 'view_ops')
        )
    )
  );

DROP POLICY IF EXISTS "Registration entries admin manage" ON registration_entries;
CREATE POLICY "Registration entries admin manage"
  ON registration_entries FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Registration audit select" ON registration_audit_events;
CREATE POLICY "Registration audit select"
  ON registration_audit_events FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.id = registration_id
        AND (
          account_manages_competitor(r.competitor_id, 'any')
          OR has_event_capability(r.event_id, 'view_ops')
        )
    )
  );
