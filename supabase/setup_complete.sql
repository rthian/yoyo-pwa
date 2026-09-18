-- Complete Setup Script for YoYo Event Management System
-- This is a SAFE script that works on both fresh and existing databases
-- Uses IF NOT EXISTS and IF EXISTS checks throughout
--
-- Run this ONCE before seed_sample_data.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CREATE TABLES (IF NOT EXISTS)
-- ============================================

-- MEMBERS TABLE
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'judge', 'member')),
  country VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);

-- EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  event_date DATE,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'completed', 'cancelled')),
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

-- DIVISIONS TABLE
CREATE TABLE IF NOT EXISTS divisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scoring_type VARCHAR(50) DEFAULT 'standard' CHECK (scoring_type IN ('standard', 'clicker', 'head_to_head')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_divisions_event ON divisions(event_id);

-- DIVISION_MEMBERS TABLE
CREATE TABLE IF NOT EXISTS division_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  play_order INTEGER,
  status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'playing', 'completed', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(division_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_division_members_division ON division_members(division_id);
CREATE INDEX IF NOT EXISTS idx_division_members_member ON division_members(member_id);

-- DIVISION_JUDGES TABLE
CREATE TABLE IF NOT EXISTS division_judges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  judge_type VARCHAR(50) DEFAULT 'general' CHECK (judge_type IN ('head', 'general', 'technical', 'performance', 'shadow')),
  scores_included_in_leaderboard BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(division_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_division_judges_division ON division_judges(division_id);
CREATE INDEX IF NOT EXISTS idx_division_judges_member ON division_judges(member_id);

-- SCORES TABLE
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  division_member_id UUID NOT NULL REFERENCES division_members(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES members(id),
  ex_clicks INTEGER DEFAULT 0,
  ex_pv DECIMAL(5,2) DEFAULT 0,
  ex_ch DECIMAL(5,2) DEFAULT 0,
  ex_cons DECIMAL(5,2) DEFAULT 0,
  ex_space DECIMAL(5,2) DEFAULT 0,
  ex_body DECIMAL(5,2) DEFAULT 0,
  ex_showman DECIMAL(5,2) DEFAULT 0,
  ex_music DECIMAL(5,2) DEFAULT 0,
  ex_construct DECIMAL(5,2) DEFAULT 0,
  ex_trick_div DECIMAL(5,2) DEFAULT 0,
  ex_deductions INTEGER DEFAULT 0,
  technical_score DECIMAL(8,2) DEFAULT 0,
  performance_score DECIMAL(8,2) DEFAULT 0,
  total_score DECIMAL(8,2) DEFAULT 0,
  is_submitted BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(division_member_id, judge_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_division ON scores(division_id);
CREATE INDEX IF NOT EXISTS idx_scores_division_member ON scores(division_member_id);
CREATE INDEX IF NOT EXISTS idx_scores_judge ON scores(judge_id);

-- LEADERBOARD_TOKENS TABLE
CREATE TABLE IF NOT EXISTS leaderboard_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  views_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_tokens_token ON leaderboard_tokens(token);
CREATE INDEX IF NOT EXISTS idx_leaderboard_tokens_division ON leaderboard_tokens(division_id);

-- OFFLINE_SCORE_QUEUE TABLE
CREATE TABLE IF NOT EXISTS offline_score_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id VARCHAR(255) NOT NULL,
  division_member_id UUID NOT NULL,
  judge_id UUID NOT NULL,
  score_data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_score_queue(status);
CREATE INDEX IF NOT EXISTS idx_offline_queue_judge ON offline_score_queue(judge_id);

-- RULESETS TABLE
CREATE TABLE IF NOT EXISTS rulesets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  version VARCHAR(50),
  source_url VARCHAR(500),
  rules_content TEXT,
  scoring_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rulesets_code ON rulesets(code);
CREATE INDEX IF NOT EXISTS idx_rulesets_active ON rulesets(is_active);

-- SCHEDULE_ENTRIES TABLE
CREATE TABLE IF NOT EXISTS schedule_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  entry_type VARCHAR(50) DEFAULT 'other' CHECK (entry_type IN ('ceremony', 'break', 'registration', 'other')),
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  venue VARCHAR(255),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_entries_event ON schedule_entries(event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_start ON schedule_entries(scheduled_start);

-- ============================================
-- ALTER EXISTING TABLES (ADD NEW COLUMNS)
-- ============================================

-- Add ruleset_id to events if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='events' AND column_name='ruleset_id'
  ) THEN
    ALTER TABLE events ADD COLUMN ruleset_id UUID REFERENCES rulesets(id);
  END IF;
END $$;

-- Add schedule columns to divisions if not exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='divisions' AND column_name='round_type'
  ) THEN
    ALTER TABLE divisions ADD COLUMN round_type VARCHAR(50) CHECK (round_type IN ('wildcard', 'qualifier', 'semi_final', 'final', 'exhibition', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='divisions' AND column_name='scheduled_start'
  ) THEN
    ALTER TABLE divisions ADD COLUMN scheduled_start TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='divisions' AND column_name='scheduled_end'
  ) THEN
    ALTER TABLE divisions ADD COLUMN scheduled_end TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='divisions' AND column_name='venue'
  ) THEN
    ALTER TABLE divisions ADD COLUMN venue VARCHAR(255);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_divisions_scheduled_start ON divisions(scheduled_start);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_score_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: is_admin() - SECURITY DEFINER to bypass RLS
-- Prevents infinite recursion when members policies reference members table
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM members
    WHERE id::text = auth.uid()::text
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- RLS POLICIES (CREATE IF NOT EXISTS via DROP/CREATE)
-- ============================================

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Members are viewable by authenticated users" ON members;
CREATE POLICY "Members are viewable by authenticated users"
  ON members FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage members" ON members;
CREATE POLICY "Admins can manage members"
  ON members FOR ALL
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Published events are viewable by all" ON events;
CREATE POLICY "Published events are viewable by all"
  ON events FOR SELECT
  TO authenticated
  USING (status IN ('published', 'active', 'completed'));

DROP POLICY IF EXISTS "Admins can manage events" ON events;
CREATE POLICY "Admins can manage events"
  ON events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id::text = auth.uid()::text 
      AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Divisions are viewable with their event" ON divisions;
CREATE POLICY "Divisions are viewable with their event"
  ON divisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = event_id 
      AND e.status IN ('published', 'active', 'completed')
    )
  );

DROP POLICY IF EXISTS "Admins can manage divisions" ON divisions;
CREATE POLICY "Admins can manage divisions"
  ON divisions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id::text = auth.uid()::text 
      AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Judges can view their assigned division scores" ON scores;
CREATE POLICY "Judges can view their assigned division scores"
  ON scores FOR SELECT
  TO authenticated
  USING (
    judge_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id::text = auth.uid()::text 
      AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Judges can insert their own scores" ON scores;
CREATE POLICY "Judges can insert their own scores"
  ON scores FOR INSERT
  TO authenticated
  WITH CHECK (judge_id::text = auth.uid()::text);

DROP POLICY IF EXISTS "Judges can update their own scores" ON scores;
CREATE POLICY "Judges can update their own scores"
  ON scores FOR UPDATE
  TO authenticated
  USING (judge_id::text = auth.uid()::text AND is_submitted = false);

DROP POLICY IF EXISTS "Leaderboard tokens viewable by admins" ON leaderboard_tokens;
CREATE POLICY "Leaderboard tokens viewable by admins"
  ON leaderboard_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id::text = auth.uid()::text 
      AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Rulesets are viewable by authenticated users" ON rulesets;
CREATE POLICY "Rulesets are viewable by authenticated users"
  ON rulesets FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage rulesets" ON rulesets;
CREATE POLICY "Admins can manage rulesets"
  ON rulesets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id::text = auth.uid()::text 
      AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Schedule entries viewable with their event" ON schedule_entries;
CREATE POLICY "Schedule entries viewable with their event"
  ON schedule_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = event_id 
      AND e.status IN ('published', 'active', 'completed')
    )
  );

DROP POLICY IF EXISTS "Admins can manage schedule entries" ON schedule_entries;
CREATE POLICY "Admins can manage schedule entries"
  ON schedule_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id::text = auth.uid()::text 
      AND m.role = 'admin'
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_division_leaderboard(p_division_id UUID)
RETURNS TABLE (
  member_id UUID,
  member_name VARCHAR,
  avg_technical DECIMAL,
  avg_performance DECIMAL,
  total_score DECIMAL,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dm.member_id,
    m.full_name as member_name,
    ROUND(AVG(s.technical_score), 2) as avg_technical,
    ROUND(AVG(s.performance_score), 2) as avg_performance,
    ROUND(AVG(s.total_score), 2) as total_score,
    RANK() OVER (ORDER BY AVG(s.total_score) DESC) as rank
  FROM division_members dm
  JOIN members m ON m.id = dm.member_id
  LEFT JOIN scores s ON s.division_member_id = dm.id AND s.is_submitted = true
  WHERE dm.division_id = p_division_id
  GROUP BY dm.member_id, m.full_name
  ORDER BY total_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS (DROP AND RECREATE)
-- ============================================

DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_divisions_updated_at ON divisions;
CREATE TRIGGER update_divisions_updated_at
  BEFORE UPDATE ON divisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_division_members_updated_at ON division_members;
CREATE TRIGGER update_division_members_updated_at
  BEFORE UPDATE ON division_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_scores_updated_at ON scores;
CREATE TRIGGER update_scores_updated_at
  BEFORE UPDATE ON scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_rulesets_updated_at ON rulesets;
CREATE TRIGGER update_rulesets_updated_at
  BEFORE UPDATE ON rulesets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_schedule_entries_updated_at ON schedule_entries;
CREATE TRIGGER update_schedule_entries_updated_at
  BEFORE UPDATE ON schedule_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

DO $$
BEGIN
  -- Only add if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'division_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE division_members;
  END IF;
END $$;

-- ============================================
-- SEED DEFAULT RULESETS
-- ============================================

INSERT INTO rulesets (name, code, description, version, scoring_config, is_active)
VALUES (
  'Default Scoring Rules',
  'RULE_00',
  'The default scoring system used by the platform. Standard clicker-based Technical Execution scoring with 10 Freestyle Evaluation categories.',
  '1.0',
  '{
    "te_weight": 60,
    "fe_weight": 40,
    "te_scoring": "clicker",
    "fe_categories_final": ["execution", "control", "trick_diversity", "space_emphasis", "music_choreography", "music_construction", "body_control", "showmanship"],
    "fe_categories_prelim": ["execution", "control", "choreography", "body_control"],
    "fe_scale_min": 0,
    "fe_scale_max": 10,
    "major_deductions": {
      "yo_yo_stop": -1,
      "yo_yo_discard": -3,
      "yo_yo_detach": -5
    },
    "rounds": ["wildcard", "prelim", "semi_final", "final"]
  }'::jsonb,
  true
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO rulesets (name, code, description, version, source_url, scoring_config, is_active)
VALUES (
  'IYYF World Yo-Yo Contest 2025',
  'IYYF_WYYC_25',
  'Official competition rules for the 2025 World Yo-Yo Contest, sanctioned by the International Yo-Yo Federation. Includes 1A-5A championship divisions plus AP (Art & Performance).',
  '2025',
  'https://iyyf.org/wyyc2025-rules/',
  '{
    "te_weight": 60,
    "fe_weight": 40,
    "te_scoring": "clicker",
    "te_normalization": true,
    "fe_categories_final": ["execution", "control", "trick_diversity", "space_emphasis", "music_choreography", "music_construction", "body_control", "showmanship"],
    "fe_categories_prelim": ["execution", "control", "choreography", "body_control"],
    "fe_scale_min": 0,
    "fe_scale_max": 10,
    "major_deductions": {
      "yo_yo_stop": -1,
      "yo_yo_discard": -3,
      "yo_yo_detach": -5,
      "flying_off": "DQ"
    },
    "rounds": ["wildcard", "prelim", "semi_final", "final"],
    "round_durations": {
      "wildcard": 30,
      "prelim": 60,
      "semi_final": 90,
      "final": 180
    },
    "divisions": ["1A", "2A", "3A", "4A", "5A", "AP"],
    "non_championship": ["womens", "over40", "junior"],
    "wildcard_te_only": true,
    "judge_groups": {
      "group_a": "technical_execution",
      "group_b": "freestyle_evaluation"
    }
  }'::jsonb,
  true
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO rulesets (name, code, description, version, source_url, scoring_config, is_active)
VALUES (
  'AP Yo-Yo Open 2026',
  'AP_26',
  'Competition rules for the AP Yo-Yo Open 2026. Features a 50/50 TE/PE scoring split with 5 Performance Evaluation categories and integrated deductions (no separate major deductions).',
  '2026',
  'https://apyoyo.com/pages/judging-rules',
  '{
    "te_weight": 50,
    "fe_weight": 50,
    "te_scoring": "clicker",
    "te_normalization": false,
    "fe_categories_final": ["performance_quality", "musicality", "trick_diversity", "uniqueness", "execution"],
    "fe_categories_prelim": ["performance_quality", "musicality", "trick_diversity", "uniqueness", "execution"],
    "fe_scale_min": 0,
    "fe_scale_max": 10,
    "major_deductions": null,
    "integrated_deductions": {
      "yo_yo_stop": -1,
      "yo_yo_discard": -3
    },
    "rounds": ["prelim", "semi_final", "final"],
    "round_durations": {
      "prelim": 60,
      "semi_final": 90,
      "final": 180
    },
    "divisions": ["1A", "2A", "3A", "4A", "5A"],
    "1a_semi_final_range": "6th_to_25th",
    "1a_finals_from_prelim": 5,
    "1a_finals_from_semi": 10
  }'::jsonb,
  true
)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Setup Complete!' as status;
SELECT 'Tables created/verified' as step, COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT 'Rulesets seeded' as step, COUNT(*) as ruleset_count 
FROM rulesets;
