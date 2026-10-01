-- Prompt 10: Music upload MVP (private storage metadata)
-- Bucket `competition-music` must be created in Supabase (private).
-- Rollback: DROP TABLE music_audit_events, music_submission_versions, music_submissions, music_requirements;

CREATE TABLE IF NOT EXISTS music_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL UNIQUE REFERENCES divisions(id) ON DELETE CASCADE,
  deadline_at TIMESTAMPTZ,
  max_duration_seconds INTEGER NOT NULL DEFAULT 240,
  max_bytes INTEGER NOT NULL DEFAULT 20971520,
  allowed_mime_types TEXT[] NOT NULL DEFAULT ARRAY['audio/mpeg','audio/wav','audio/x-wav','audio/mp4'],
  policy_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_music_requirements_updated_at ON music_requirements;
CREATE TRIGGER update_music_requirements_updated_at
  BEFORE UPDATE ON music_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS music_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'missing'
    CHECK (status IN (
      'missing', 'uploaded', 'processing', 'flagged',
      'approved', 'rejected', 'locked'
    )),
  active_version_id UUID,
  deadline_exception_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (division_id, competitor_id)
);

CREATE TABLE IF NOT EXISTS music_submission_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES music_submissions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  checksum_sha256 TEXT,
  duration_seconds NUMERIC,
  validation_pending BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT false,
  copyright_declared BOOLEAN NOT NULL DEFAULT false,
  explicit_content_declared BOOLEAN NOT NULL DEFAULT false,
  usage_declared BOOLEAN NOT NULL DEFAULT false,
  uploaded_by_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id, version_number)
);

ALTER TABLE music_submissions
  DROP CONSTRAINT IF EXISTS music_submissions_active_version_fk;
ALTER TABLE music_submissions
  ADD CONSTRAINT music_submissions_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES music_submission_versions(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS music_audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES music_submissions(id) ON DELETE CASCADE,
  version_id UUID REFERENCES music_submission_versions(id) ON DELETE SET NULL,
  actor_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_music_submissions_division ON music_submissions(division_id, status);
CREATE INDEX IF NOT EXISTS idx_music_versions_submission ON music_submission_versions(submission_id, version_number DESC);

ALTER TABLE music_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_submission_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Music requirements select" ON music_requirements;
CREATE POLICY "Music requirements select" ON music_requirements FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Music requirements admin" ON music_requirements;
CREATE POLICY "Music requirements admin" ON music_requirements FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Music submissions select" ON music_submissions;
CREATE POLICY "Music submissions select" ON music_submissions FOR SELECT TO authenticated
  USING (
    is_admin()
    OR account_manages_competitor(competitor_id, 'music')
    OR has_event_capability(
      (SELECT d.event_id FROM divisions d WHERE d.id = division_id),
      'view_ops'
    )
  );

DROP POLICY IF EXISTS "Music submissions admin" ON music_submissions;
CREATE POLICY "Music submissions admin" ON music_submissions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Music versions select" ON music_submission_versions;
CREATE POLICY "Music versions select" ON music_submission_versions FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM music_submissions s
      WHERE s.id = submission_id
        AND (
          account_manages_competitor(s.competitor_id, 'music')
          OR has_event_capability(
            (SELECT d.event_id FROM divisions d WHERE d.id = s.division_id),
            'view_ops'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Music versions admin" ON music_submission_versions;
CREATE POLICY "Music versions admin" ON music_submission_versions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Music audit select" ON music_audit_events;
CREATE POLICY "Music audit select" ON music_audit_events FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM music_submissions s
      WHERE s.id = submission_id
        AND (
          account_manages_competitor(s.competitor_id, 'music')
          OR has_event_capability(
            (SELECT d.event_id FROM divisions d WHERE d.id = s.division_id),
            'view_ops'
          )
        )
    )
  );
