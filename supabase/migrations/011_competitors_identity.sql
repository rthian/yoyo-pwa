-- Slice A: Account vs Competitor identity (additive only)
-- ADR: keep members as Auth accounts; competitors own competition identity.
-- No FK remaps yet — enrollment/rankings still point at members.
-- Rollback: DROP TABLE account_competitor_links; DROP TABLE competitors;
--           DROP FUNCTION account_manages_competitor(uuid, text);

-- ---------------------------------------------------------------------------
-- competitors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Slice A bridge: maps backfilled row to the Auth account member. Drop in Slice E.
  source_member_id UUID UNIQUE REFERENCES members(id) ON DELETE SET NULL,
  public_id VARCHAR(16),
  full_name VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  country VARCHAR(100),
  home_geo_id UUID REFERENCES geo_nodes(id),
  gender VARCHAR(20) DEFAULT 'undisclosed'
    CHECK (gender IN ('female', 'male', 'other', 'undisclosed')),
  avatar_url TEXT,
  bio TEXT,
  profile_visibility VARCHAR(20) DEFAULT 'public'
    CHECK (profile_visibility IN ('public', 'members_only', 'private')),
  date_of_birth DATE,
  first_competed_on DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_competitors_public_id
  ON competitors(public_id) WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competitors_full_name_trgm
  ON competitors USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_competitors_nickname_trgm
  ON competitors USING gin (nickname gin_trgm_ops);

DROP TRIGGER IF EXISTS update_competitors_updated_at ON competitors;
CREATE TRIGGER update_competitors_updated_at
  BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- account_competitor_links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_competitor_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE RESTRICT,
  relationship VARCHAR(20) NOT NULL
    CHECK (relationship IN ('self', 'guardian', 'manager', 'coach')),
  can_register BOOLEAN NOT NULL DEFAULT true,
  can_manage_music BOOLEAN NOT NULL DEFAULT false,
  can_manage_profile BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, competitor_id)
);

-- At most one self link per competitor (orphans without self are allowed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_competitor_links_one_self
  ON account_competitor_links(competitor_id)
  WHERE relationship = 'self';

CREATE INDEX IF NOT EXISTS idx_account_competitor_links_account
  ON account_competitor_links(account_id);

CREATE INDEX IF NOT EXISTS idx_account_competitor_links_competitor
  ON account_competitor_links(competitor_id);

-- ---------------------------------------------------------------------------
-- Backfill: one competitor + self link for members with competition identity
-- Skip judge/admin-only accounts with no history/profile markers.
-- ---------------------------------------------------------------------------
INSERT INTO competitors (
  source_member_id,
  full_name,
  nickname,
  country,
  home_geo_id,
  gender,
  avatar_url,
  bio,
  profile_visibility,
  first_competed_on,
  public_id,
  is_active,
  created_at,
  updated_at
)
SELECT
  m.id,
  m.full_name,
  m.nickname,
  m.country,
  m.home_geo_id,
  COALESCE(m.gender, 'undisclosed'),
  m.avatar_url,
  m.bio,
  COALESCE(m.profile_visibility, 'public'),
  m.first_competed_on,
  m.public_id,
  COALESCE(m.is_active, true),
  COALESCE(m.created_at, NOW()),
  COALESCE(m.updated_at, NOW())
FROM members m
WHERE
  (
    m.public_id IS NOT NULL
    OR m.role = 'member'
    OR EXISTS (SELECT 1 FROM division_members dm WHERE dm.member_id = m.id)
    OR EXISTS (SELECT 1 FROM division_results dr WHERE dr.member_id = m.id)
    OR EXISTS (SELECT 1 FROM ranking_points rp WHERE rp.member_id = m.id)
    OR EXISTS (SELECT 1 FROM season_titles st WHERE st.member_id = m.id)
    OR EXISTS (SELECT 1 FROM member_privileges mp WHERE mp.member_id = m.id)
  )
  AND NOT EXISTS (
    SELECT 1 FROM competitors c WHERE c.source_member_id = m.id
  );

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
    SELECT 1 FROM account_competitor_links l
    WHERE l.account_id = c.source_member_id AND l.competitor_id = c.id
  )
ON CONFLICT (account_id, competitor_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Auth helpers (SECURITY DEFINER — avoid members RLS recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION account_manages_competitor(
  p_competitor_id UUID,
  p_capability TEXT DEFAULT 'any'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF is_admin() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM account_competitor_links l
    WHERE l.competitor_id = p_competitor_id
      AND l.account_id::text = auth.uid()::text
      AND (
        p_capability IS NULL
        OR p_capability = 'any'
        OR (p_capability = 'register' AND l.can_register)
        OR (p_capability = 'music' AND l.can_manage_music)
        OR (p_capability = 'profile' AND l.can_manage_profile)
      )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_competitor_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Competitors public or linked select" ON competitors;
CREATE POLICY "Competitors public or linked select"
  ON competitors FOR SELECT
  USING (
    is_admin()
    OR profile_visibility = 'public'
    OR (profile_visibility = 'members_only' AND auth.uid() IS NOT NULL)
    OR account_manages_competitor(id, 'any')
  );

DROP POLICY IF EXISTS "Competitors manage by link or admin" ON competitors;
CREATE POLICY "Competitors manage by link or admin"
  ON competitors FOR ALL
  TO authenticated
  USING (is_admin() OR account_manages_competitor(id, 'profile'))
  WITH CHECK (is_admin() OR account_manages_competitor(id, 'profile'));

DROP POLICY IF EXISTS "Links select own or admin" ON account_competitor_links;
CREATE POLICY "Links select own or admin"
  ON account_competitor_links FOR SELECT
  TO authenticated
  USING (is_admin() OR account_id::text = auth.uid()::text);

-- Slice A: mutations on links are admin-only (signup uses service role)
DROP POLICY IF EXISTS "Links admin manage" ON account_competitor_links;
CREATE POLICY "Links admin manage"
  ON account_competitor_links FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
