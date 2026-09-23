-- League rankings: FIP-style placement points with category + geo filters
-- Additive only — does not change live division leaderboard behavior
--
-- Applied via: supabase db push / SQL editor (not imported by app code).
-- Consumers: lib/rankings/*, app/api/rankings/*, app/api/admin/events/[id]/finalize,
--            app/api/divisions/[id]/lock (snapshots), app/rankings/*

-- ---------------------------------------------------------------------------
-- Play categories (1A–5A, AP)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS play_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(16) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_championship BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO play_categories (code, name, is_championship, sort_order) VALUES
  ('1A', 'Single String', true, 10),
  ('2A', 'Double Looping', true, 20),
  ('3A', 'Double String', true, 30),
  ('4A', 'Offstring', true, 40),
  ('5A', 'Freehand', true, 50),
  ('AP', 'Art & Performance', false, 60)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE divisions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES play_categories(id);
CREATE INDEX IF NOT EXISTS idx_divisions_category ON divisions(category_id);

UPDATE divisions d
SET category_id = c.id
FROM play_categories c
WHERE d.category_id IS NULL
  AND upper(trim(d.name)) ~ ('^' || c.code || '(\s|$|-|/)');

-- ---------------------------------------------------------------------------
-- Geography: world → region → country → state
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS geo_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES geo_nodes(id) ON DELETE RESTRICT,
  level VARCHAR(20) NOT NULL CHECK (level IN ('world', 'region', 'country', 'state')),
  code VARCHAR(16) NOT NULL,
  name VARCHAR(120) NOT NULL,
  iso_alpha2 CHAR(2),
  path TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_id, code)
);

CREATE INDEX IF NOT EXISTS idx_geo_nodes_path ON geo_nodes (path text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_geo_nodes_parent ON geo_nodes (parent_id);
CREATE INDEX IF NOT EXISTS idx_geo_nodes_level ON geo_nodes (level);
CREATE INDEX IF NOT EXISTS idx_geo_nodes_iso ON geo_nodes (iso_alpha2) WHERE iso_alpha2 IS NOT NULL;

CREATE OR REPLACE FUNCTION geo_nodes_set_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := '/' || NEW.code;
  ELSE
    SELECT path INTO parent_path FROM geo_nodes WHERE id = NEW.parent_id;
    IF parent_path IS NULL THEN
      RAISE EXCEPTION 'Parent geo node not found';
    END IF;
    NEW.path := parent_path || '/' || NEW.code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_geo_nodes_path ON geo_nodes;
CREATE TRIGGER trg_geo_nodes_path
  BEFORE INSERT OR UPDATE OF parent_id, code ON geo_nodes
  FOR EACH ROW EXECUTE FUNCTION geo_nodes_set_path();

ALTER TABLE members ADD COLUMN IF NOT EXISTS home_geo_id UUID REFERENCES geo_nodes(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_id UUID REFERENCES geo_nodes(id);
CREATE INDEX IF NOT EXISTS idx_members_home_geo ON members(home_geo_id);
CREATE INDEX IF NOT EXISTS idx_events_geo ON events(geo_id);

INSERT INTO geo_nodes (id, parent_id, level, code, name, path, sort_order)
VALUES ('00000000-0000-4000-8000-000000000001', NULL, 'world', 'WORLD', 'World', '/WORLD', 0)
ON CONFLICT (path) DO NOTHING;

-- Regions: omit path (trigger sets it); skip if code already exists
INSERT INTO geo_nodes (id, parent_id, level, code, name, sort_order)
SELECT v.id, w.id, 'region', v.code, v.name, v.sort_order
FROM geo_nodes w
CROSS JOIN (VALUES
  ('00000000-0000-4000-8000-000000000010'::uuid, 'ASIA', 'Asia', 10),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'SEA', 'Southeast Asia', 11),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'EU', 'Europe', 20),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'NA', 'North America', 30),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'SA', 'South America', 40),
  ('00000000-0000-4000-8000-000000000015'::uuid, 'OC', 'Oceania', 50),
  ('00000000-0000-4000-8000-000000000016'::uuid, 'AF', 'Africa', 60),
  ('00000000-0000-4000-8000-000000000017'::uuid, 'ME', 'Middle East', 70)
) AS v(id, code, name, sort_order)
WHERE w.code = 'WORLD'
  AND NOT EXISTS (
    SELECT 1 FROM geo_nodes g WHERE g.code = v.code AND g.level = 'region'
  );

-- ---------------------------------------------------------------------------
-- Seasons, event tiers, points tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS points_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  code VARCHAR(60) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points_table_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  points_table_id UUID NOT NULL REFERENCES points_tables(id) ON DELETE CASCADE,
  round_type VARCHAR(50) NOT NULL
    CHECK (round_type IN ('wildcard', 'qualifier', 'semi_final', 'final')),
  placement_from INTEGER NOT NULL CHECK (placement_from >= 1),
  placement_to INTEGER NOT NULL CHECK (placement_to >= 1),
  points DECIMAL(8,2) NOT NULL CHECK (points >= 0),
  CHECK (placement_to >= placement_from),
  UNIQUE (points_table_id, round_type, placement_from)
);

CREATE INDEX IF NOT EXISTS idx_points_rows_lookup
  ON points_table_rows (points_table_id, round_type, placement_from, placement_to);

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(60) UNIQUE NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  points_table_id UUID REFERENCES points_tables(id),
  counting_results INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (ends_on > starts_on)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_one_active ON seasons(is_active) WHERE is_active;

CREATE TABLE IF NOT EXISTS event_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO event_tiers (code, name, multiplier, sort_order) VALUES
  ('LOCAL', 'Local / Club', 0.50, 10),
  ('STATE', 'State', 1.00, 20),
  ('NATIONAL', 'National', 2.00, 30),
  ('REGIONAL', 'Regional', 3.00, 40),
  ('WORLD', 'World', 5.00, 50)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE events ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES event_tiers(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);
CREATE INDEX IF NOT EXISTS idx_events_season ON events(season_id);

INSERT INTO points_tables (id, name, code, description)
VALUES (
  '00000000-0000-4000-8000-000000000100',
  'Default League Points v1',
  'DEFAULT_V1',
  'Participation floor + deeper rounds dominate. Finalists earn more than qualifier winners.'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO points_table_rows (points_table_id, round_type, placement_from, placement_to, points)
SELECT '00000000-0000-4000-8000-000000000100', r.round_type, r.placement_from, r.placement_to, r.points
FROM (VALUES
  ('wildcard'::text, 1, 9999, 5.00),
  ('qualifier', 1, 1, 40.00),
  ('qualifier', 2, 2, 34.00),
  ('qualifier', 3, 3, 29.00),
  ('qualifier', 4, 5, 24.00),
  ('qualifier', 6, 10, 18.00),
  ('qualifier', 11, 20, 12.00),
  ('qualifier', 21, 9999, 8.00),
  ('semi_final', 1, 1, 90.00),
  ('semi_final', 2, 3, 75.00),
  ('semi_final', 4, 6, 62.00),
  ('semi_final', 7, 10, 52.00),
  ('semi_final', 11, 9999, 45.00),
  ('final', 1, 1, 250.00),
  ('final', 2, 2, 200.00),
  ('final', 3, 3, 165.00),
  ('final', 4, 4, 135.00),
  ('final', 5, 5, 115.00),
  ('final', 6, 8, 95.00),
  ('final', 9, 9999, 80.00)
) AS r(round_type, placement_from, placement_to, points)
ON CONFLICT (points_table_id, round_type, placement_from) DO NOTHING;

INSERT INTO seasons (id, name, slug, starts_on, ends_on, is_active, points_table_id)
VALUES (
  '00000000-0000-4000-8000-000000000200',
  '2026 Season',
  '2026',
  '2026-01-01',
  '2026-12-31',
  true,
  '00000000-0000-4000-8000-000000000100'
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Frozen results + points ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS division_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  placement INTEGER,
  total_score DECIMAL(8,2),
  score_count INTEGER DEFAULT 0,
  source VARCHAR(10) DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (division_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_division_results_member ON division_results(member_id);
CREATE INDEX IF NOT EXISTS idx_division_results_division ON division_results(division_id);

CREATE TABLE IF NOT EXISTS ranking_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES play_categories(id),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  division_id UUID REFERENCES divisions(id) ON DELETE SET NULL,
  round_type VARCHAR(50) NOT NULL,
  placement INTEGER,
  field_size INTEGER,
  base_points DECIMAL(8,2) NOT NULL DEFAULT 0,
  bonus_points DECIMAL(8,2) NOT NULL DEFAULT 0,
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  points DECIMAL(8,2) NOT NULL DEFAULT 0,
  representing_geo_id UUID REFERENCES geo_nodes(id),
  event_date DATE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE (event_id, category_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_points_leaderboard
  ON ranking_points (season_id, category_id, member_id);
CREATE INDEX IF NOT EXISTS idx_ranking_points_member ON ranking_points (member_id, season_id);
CREATE INDEX IF NOT EXISTS idx_ranking_points_event ON ranking_points (event_id);

-- ---------------------------------------------------------------------------
-- RLS — public read; admin write
-- ---------------------------------------------------------------------------
ALTER TABLE play_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_table_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Play categories are public" ON play_categories;
CREATE POLICY "Play categories are public" ON play_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage play categories" ON play_categories;
CREATE POLICY "Admins manage play categories" ON play_categories FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Geo nodes are public" ON geo_nodes;
CREATE POLICY "Geo nodes are public" ON geo_nodes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage geo nodes" ON geo_nodes;
CREATE POLICY "Admins manage geo nodes" ON geo_nodes FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Points tables are public" ON points_tables;
CREATE POLICY "Points tables are public" ON points_tables FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage points tables" ON points_tables;
CREATE POLICY "Admins manage points tables" ON points_tables FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Points table rows are public" ON points_table_rows;
CREATE POLICY "Points table rows are public" ON points_table_rows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage points table rows" ON points_table_rows;
CREATE POLICY "Admins manage points table rows" ON points_table_rows FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Seasons are public" ON seasons;
CREATE POLICY "Seasons are public" ON seasons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage seasons" ON seasons;
CREATE POLICY "Admins manage seasons" ON seasons FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Event tiers are public" ON event_tiers;
CREATE POLICY "Event tiers are public" ON event_tiers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage event tiers" ON event_tiers;
CREATE POLICY "Admins manage event tiers" ON event_tiers FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Division results are public" ON division_results;
CREATE POLICY "Division results are public" ON division_results FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage division results" ON division_results;
CREATE POLICY "Admins manage division results" ON division_results FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Ranking points are public" ON ranking_points;
CREATE POLICY "Ranking points are public" ON ranking_points FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage ranking points" ON ranking_points;
CREATE POLICY "Admins manage ranking points" ON ranking_points FOR ALL USING (is_admin());
