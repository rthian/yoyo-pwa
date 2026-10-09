-- Prompt 12: Official published results (event-level publish gate)
-- Serves frozen division_results publicly; independent of season finalize.
-- Rollback: DROP TABLE published_results_audit;
--           ALTER TABLE events DROP COLUMN IF EXISTS results_published_at, results_published_by;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS results_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS results_published_by UUID REFERENCES members(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS published_results_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action VARCHAR(16) NOT NULL CHECK (action IN ('publish', 'unpublish', 'republish')),
  actor_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_published_results_audit_event
  ON published_results_audit(event_id, created_at DESC);

ALTER TABLE published_results_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published results audit select" ON published_results_audit;
CREATE POLICY "Published results audit select"
  ON published_results_audit FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR has_event_capability(event_id, 'view_ops')
  );

DROP POLICY IF EXISTS "Published results audit admin insert" ON published_results_audit;
CREATE POLICY "Published results audit admin insert"
  ON published_results_audit FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());
