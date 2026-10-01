-- Prompt 7 + 8: Score revisions (immutable) + offline idempotency
-- Leaderboard still reads scores table (latest state).
-- Rollback: DROP TABLE score_revisions;
--           ALTER TABLE scores DROP COLUMN IF EXISTS score_version, client_submission_id;

ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS score_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS client_submission_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_client_submission_id
  ON scores(client_submission_id)
  WHERE client_submission_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS score_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  score_id UUID NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  division_member_id UUID NOT NULL REFERENCES division_members(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES members(id),
  score_version INTEGER NOT NULL,
  previous_payload JSONB,
  new_payload JSONB NOT NULL,
  actor_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  reason TEXT,
  source VARCHAR(32) NOT NULL DEFAULT 'online'
    CHECK (source IN ('online', 'offline_sync', 'admin', 'system')),
  client_submission_id TEXT,
  client_timestamp TIMESTAMPTZ,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_outcome VARCHAR(32)
    CHECK (sync_outcome IS NULL OR sync_outcome IN (
      'accepted', 'duplicate', 'superseded', 'locked',
      'unauthorized', 'invalid', 'conflict'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_revisions_score
  ON score_revisions(score_id, score_version DESC);
CREATE INDEX IF NOT EXISTS idx_score_revisions_division
  ON score_revisions(division_id, created_at DESC);

-- Append-only: no UPDATE/DELETE for non-service roles
ALTER TABLE score_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Score revisions select own or head or admin" ON score_revisions;
CREATE POLICY "Score revisions select own or head or admin"
  ON score_revisions FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR judge_id::text = auth.uid()::text
    OR is_division_head_judge(division_id)
  );

-- Block mutations via authenticated role (writes use service role)
DROP POLICY IF EXISTS "Score revisions no client mutate" ON score_revisions;
CREATE POLICY "Score revisions no client mutate"
  ON score_revisions FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
