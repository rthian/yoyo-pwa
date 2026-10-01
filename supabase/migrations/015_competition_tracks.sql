-- Prompt 6: Competition tracks + stage progression (additive)
-- Divisions remain scoring stages. No automatic advancement.
-- Rollback: DROP TABLE advancement_decisions, advancement_rules, registration_track_entries;
--           ALTER TABLE divisions DROP COLUMN IF EXISTS track_id, stage_order, allow_direct_entry;
--           DROP TABLE competition_tracks;

CREATE TABLE IF NOT EXISTS competition_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES play_categories(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competition_tracks_event
  ON competition_tracks(event_id, sort_order);

DROP TRIGGER IF EXISTS update_competition_tracks_updated_at ON competition_tracks;
CREATE TRIGGER update_competition_tracks_updated_at
  BEFORE UPDATE ON competition_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE divisions
  ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES competition_tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_direct_entry BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_divisions_track
  ON divisions(track_id, stage_order);

-- Backfill: one default track per event; attach unassigned divisions
INSERT INTO competition_tracks (event_id, name, description, sort_order)
SELECT e.id, 'Main competition', 'Backfilled default track', 0
FROM events e
WHERE NOT EXISTS (
  SELECT 1 FROM competition_tracks t WHERE t.event_id = e.id
);

UPDATE divisions d
SET track_id = t.id,
    stage_order = COALESCE(d.sort_order, 0)
FROM competition_tracks t
WHERE t.event_id = d.event_id
  AND d.track_id IS NULL
  AND t.name = 'Main competition';

-- Advancement rules (manual apply only until preview UI approved)
CREATE TABLE IF NOT EXISTS advancement_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID NOT NULL REFERENCES competition_tracks(id) ON DELETE CASCADE,
  from_division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  to_division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  rule_type VARCHAR(32) NOT NULL DEFAULT 'manual'
    CHECK (rule_type IN ('manual', 'top_n', 'score_threshold', 'seeded')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_division_id <> to_division_id)
);

CREATE INDEX IF NOT EXISTS idx_advancement_rules_track ON advancement_rules(track_id);

CREATE TABLE IF NOT EXISTS advancement_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID NOT NULL REFERENCES competition_tracks(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES advancement_rules(id) ON DELETE SET NULL,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE RESTRICT,
  from_division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  to_division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  decision VARCHAR(20) NOT NULL
    CHECK (decision IN ('advanced', 'not_advanced', 'seeded', 'wildcard', 'override')),
  reason TEXT,
  actor_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advancement_decisions_track
  ON advancement_decisions(track_id, created_at DESC);

-- Registration can target a track (stages materialize separately / first stage)
CREATE TABLE IF NOT EXISTS registration_track_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES competition_tracks(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'pending', 'confirmed', 'waitlisted',
      'cancelled', 'rejected', 'checked_in'
    )),
  target_division_id UUID REFERENCES divisions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registration_id, track_id)
);

DROP TRIGGER IF EXISTS update_registration_track_entries_updated_at ON registration_track_entries;
CREATE TRIGGER update_registration_track_entries_updated_at
  BEFORE UPDATE ON registration_track_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE competition_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE advancement_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE advancement_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_track_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tracks select" ON competition_tracks;
CREATE POLICY "Tracks select" ON competition_tracks FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Tracks admin manage" ON competition_tracks;
CREATE POLICY "Tracks admin manage" ON competition_tracks FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Advancement rules select" ON advancement_rules;
CREATE POLICY "Advancement rules select" ON advancement_rules FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Advancement rules admin" ON advancement_rules;
CREATE POLICY "Advancement rules admin" ON advancement_rules FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Advancement decisions select" ON advancement_decisions;
CREATE POLICY "Advancement decisions select" ON advancement_decisions FOR SELECT TO authenticated
  USING (is_admin() OR has_event_capability(
    (SELECT event_id FROM competition_tracks t WHERE t.id = track_id),
    'view_ops'
  ));

DROP POLICY IF EXISTS "Advancement decisions admin" ON advancement_decisions;
CREATE POLICY "Advancement decisions admin" ON advancement_decisions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Registration track entries select" ON registration_track_entries;
CREATE POLICY "Registration track entries select" ON registration_track_entries FOR SELECT TO authenticated
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

DROP POLICY IF EXISTS "Registration track entries admin" ON registration_track_entries;
CREATE POLICY "Registration track entries admin" ON registration_track_entries FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
