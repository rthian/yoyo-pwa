-- Migration: Add Rulesets Library and Schedule System
-- Run this SQL in your Supabase SQL Editor if the database already exists

-- ============================================
-- RULESETS TABLE (Competition Rules Library)
-- ============================================
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

-- ============================================
-- SCHEDULE_ENTRIES TABLE
-- ============================================
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
-- ALTER EXISTING TABLES
-- ============================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS ruleset_id UUID REFERENCES rulesets(id);

ALTER TABLE divisions ADD COLUMN IF NOT EXISTS round_type VARCHAR(50) CHECK (round_type IN ('wildcard', 'qualifier', 'semi_final', 'final', 'exhibition', 'other'));
ALTER TABLE divisions ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
ALTER TABLE divisions ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
ALTER TABLE divisions ADD COLUMN IF NOT EXISTS venue VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_divisions_scheduled_start ON divisions(scheduled_start);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================
CREATE POLICY "Rulesets are viewable by authenticated users"
  ON rulesets FOR SELECT
  TO authenticated
  USING (is_active = true);

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
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_rulesets_updated_at
  BEFORE UPDATE ON rulesets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_schedule_entries_updated_at
  BEFORE UPDATE ON schedule_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA: Default Rulesets
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
