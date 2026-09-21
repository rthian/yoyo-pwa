-- Rankings UX: gender, public profiles, division eligibility, titles
-- Applied via Supabase SQL Editor (not imported by app JS).
-- Consumers: lib/rankings/*, app/api/rankings/*, app/players/*, app/api/search/*,
--            components/rankings/*, app/rankings/how-it-works/*
-- Glob: no 005_*.sql yet (only 001–004).
-- Fields: members.gender ('female'|'male'|'other'|'undisclosed'), public_id VARCHAR(16),
--   divisions.eligibility, season_titles, member_privileges. Dates: first_competed_on DATE, awarded_at TIMESTAMPTZ.
-- User: "The rankings page, filter needs to be better let's use WCA as a reference...
--   There should also have gender... member profile page... search... page that explain...
--   2026 season... special privileges to previous top rankers?"

ALTER TABLE members ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'undisclosed';
DO $$ BEGIN
  ALTER TABLE members ADD CONSTRAINT members_gender_check
    CHECK (gender IN ('female', 'male', 'other', 'undisclosed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE members ADD COLUMN IF NOT EXISTS public_id VARCHAR(16);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_public_id ON members(public_id) WHERE public_id IS NOT NULL;

ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(20) DEFAULT 'public';
DO $$ BEGIN
  ALTER TABLE members ADD CONSTRAINT members_profile_visibility_check
    CHECK (profile_visibility IN ('public', 'members_only', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE members ADD COLUMN IF NOT EXISTS first_competed_on DATE;

ALTER TABLE divisions ADD COLUMN IF NOT EXISTS eligibility VARCHAR(20) DEFAULT 'open';
DO $$ BEGIN
  ALTER TABLE divisions ADD CONSTRAINT divisions_eligibility_check
    CHECK (eligibility IN ('open', 'women', 'youth', 'masters'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ranking_points ADD COLUMN IF NOT EXISTS eligibility VARCHAR(20) DEFAULT 'open';
CREATE INDEX IF NOT EXISTS idx_ranking_points_eligibility
  ON ranking_points (season_id, category_id, eligibility);

ALTER TABLE seasons ADD COLUMN IF NOT EXISTS min_field_size INTEGER DEFAULT 4;

CREATE TABLE IF NOT EXISTS season_titles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES play_categories(id),
  geo_id UUID REFERENCES geo_nodes(id),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank >= 1),
  title_kind VARCHAR(40) NOT NULL DEFAULT 'champion'
    CHECK (title_kind IN ('champion', 'runner_up', 'third', 'national_champion')),
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, category_id, geo_id, rank, title_kind)
);

CREATE INDEX IF NOT EXISTS idx_season_titles_member ON season_titles(member_id);

CREATE TABLE IF NOT EXISTS member_privileges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  category_id UUID REFERENCES play_categories(id),
  kind VARCHAR(40) NOT NULL
    CHECK (kind IN ('seed', 'bye', 'guaranteed_entry', 'protected_rank', 'title_badge')),
  scope_geo_id UUID REFERENCES geo_nodes(id),
  notes TEXT,
  granted_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_privileges_member ON member_privileges(member_id, season_id);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE VIEW public_members AS
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
FROM members
WHERE is_active = true
  AND profile_visibility = 'public';

ALTER TABLE season_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_privileges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Season titles are public" ON season_titles;
CREATE POLICY "Season titles are public" ON season_titles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage season titles" ON season_titles;
CREATE POLICY "Admins manage season titles" ON season_titles FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Privileges are public" ON member_privileges;
CREATE POLICY "Privileges are public" ON member_privileges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage privileges" ON member_privileges;
CREATE POLICY "Admins manage privileges" ON member_privileges FOR ALL USING (is_admin());

-- Opaque League IDs are issued by app/scripts (YL-XXXXXX), not year/name.
-- Leave public_id null for new DBs; run: npx tsx --env-file=.env.local scripts/regenerate-league-ids.ts
