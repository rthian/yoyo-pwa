-- Custom League (placeholder name; formerly discussed as IRONMAN):
-- admin-curated contest sets with their own standings / title.
-- Does not change World/National race logic — filters the same ranking_points ledger.
--
-- Apply after 004 + 005. Consumers: lib/rankings/query.ts, app/api/rankings/leagues/*,
-- app/api/admin/custom-leagues/*.

CREATE TABLE IF NOT EXISTS custom_leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  description TEXT,
  counting_results INTEGER,
  eligibility_mode VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (eligibility_mode IN ('open', 'home_geo')),
  home_geo_id UUID REFERENCES geo_nodes(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, slug),
  CHECK (
    eligibility_mode <> 'home_geo'
    OR home_geo_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_custom_leagues_season
  ON custom_leagues (season_id, is_active);
CREATE INDEX IF NOT EXISTS idx_custom_leagues_slug
  ON custom_leagues (slug);

CREATE TABLE IF NOT EXISTS custom_league_events (
  league_id UUID NOT NULL REFERENCES custom_leagues(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (league_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_league_events_event
  ON custom_league_events (event_id);

ALTER TABLE custom_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_league_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Custom leagues are public" ON custom_leagues;
CREATE POLICY "Custom leagues are public" ON custom_leagues
  FOR SELECT USING (is_active = true OR is_admin());

DROP POLICY IF EXISTS "Admins manage custom leagues" ON custom_leagues;
CREATE POLICY "Admins manage custom leagues" ON custom_leagues
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Custom league events are public" ON custom_league_events;
CREATE POLICY "Custom league events are public" ON custom_league_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM custom_leagues cl
      WHERE cl.id = league_id AND (cl.is_active = true OR is_admin())
    )
  );

DROP POLICY IF EXISTS "Admins manage custom league events" ON custom_league_events;
CREATE POLICY "Admins manage custom league events" ON custom_league_events
  FOR ALL USING (is_admin());

COMMENT ON TABLE custom_leagues IS
  'Custom League: admin-curated participation race (placeholder name). Separate from World/National Race.';
COMMENT ON TABLE custom_league_events IS
  'Events included in a Custom League. Admin chooses the contest set.';
