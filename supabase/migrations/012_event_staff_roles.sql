-- Prompt 3 Slice 1: Event-scoped staff roles (additive only)
-- Global admin retains full access; event roles do not weaken it.
-- Rollback: DROP TABLE event_staff_role_audit; DROP TABLE event_staff_roles;
--           DROP FUNCTION has_event_role(uuid, text); DROP FUNCTION has_event_capability(uuid, text);
--           DROP FUNCTION is_division_head_judge(uuid);

-- ---------------------------------------------------------------------------
-- event_staff_roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_staff_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL
    CHECK (role IN (
      'owner',
      'organizer',
      'registration_manager',
      'music_manager',
      'head_judge',
      'stage_manager',
      'readonly_staff'
    )),
  granted_by UUID REFERENCES members(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active grant per (event, account, role)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_staff_roles_active_unique
  ON event_staff_roles(event_id, account_id, role)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_staff_roles_event
  ON event_staff_roles(event_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_staff_roles_account
  ON event_staff_roles(account_id)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- event_staff_role_audit (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_staff_role_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL,
  action VARCHAR(16) NOT NULL CHECK (action IN ('grant', 'revoke')),
  actor_id UUID REFERENCES members(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_staff_role_audit_event
  ON event_staff_role_audit(event_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Backfill: events.created_by → active owner
-- ---------------------------------------------------------------------------
INSERT INTO event_staff_roles (event_id, account_id, role, granted_by, granted_at)
SELECT
  e.id,
  e.created_by,
  'owner',
  e.created_by,
  COALESCE(e.created_at, NOW())
FROM events e
WHERE e.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM event_staff_roles r
    WHERE r.event_id = e.id
      AND r.account_id = e.created_by
      AND r.role = 'owner'
      AND r.revoked_at IS NULL
  );

INSERT INTO event_staff_role_audit (event_id, account_id, role, action, actor_id, note)
SELECT
  e.id,
  e.created_by,
  'owner',
  'grant',
  e.created_by,
  'Backfill from events.created_by'
FROM events e
WHERE e.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM event_staff_role_audit a
    WHERE a.event_id = e.id
      AND a.account_id = e.created_by
      AND a.role = 'owner'
      AND a.action = 'grant'
      AND a.note = 'Backfill from events.created_by'
  );

-- ---------------------------------------------------------------------------
-- Auth helpers (SECURITY DEFINER — avoid members RLS recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_event_role(
  p_event_id UUID,
  p_role TEXT
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
    FROM event_staff_roles r
    WHERE r.event_id = p_event_id
      AND r.account_id::text = auth.uid()::text
      AND r.role = p_role
      AND r.revoked_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_division_head_judge(p_division_id UUID)
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
    FROM division_judges dj
    WHERE dj.division_id = p_division_id
      AND dj.member_id::text = auth.uid()::text
      AND dj.judge_type = 'head'
  );
END;
$$;

-- Capability map mirrors lib/auth/event-permissions.ts
CREATE OR REPLACE FUNCTION has_event_capability(
  p_event_id UUID,
  p_capability TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_roles TEXT[];
BEGIN
  IF is_admin() THEN
    RETURN true;
  END IF;

  v_roles := CASE p_capability
    WHEN 'manage_event' THEN ARRAY['owner', 'organizer']
    WHEN 'manage_staff' THEN ARRAY['owner']
    WHEN 'delete_event' THEN ARRAY['owner']
    WHEN 'cancel_event' THEN ARRAY['owner']
    WHEN 'manage_divisions' THEN ARRAY['owner', 'organizer']
    WHEN 'assign_judges' THEN ARRAY['owner', 'organizer', 'head_judge']
    WHEN 'manage_registration' THEN ARRAY['owner', 'organizer', 'registration_manager']
    WHEN 'manage_music' THEN ARRAY['owner', 'organizer', 'music_manager']
    WHEN 'manage_schedule' THEN ARRAY['owner', 'organizer', 'stage_manager']
    WHEN 'manage_play_order' THEN ARRAY['owner', 'organizer', 'registration_manager', 'stage_manager']
    WHEN 'check_in' THEN ARRAY['owner', 'organizer', 'registration_manager', 'stage_manager']
    WHEN 'lock_scores' THEN ARRAY['owner', 'head_judge']
    WHEN 'view_ops' THEN ARRAY['owner', 'organizer', 'registration_manager', 'music_manager', 'head_judge', 'stage_manager', 'readonly_staff']
    WHEN 'finalize_results' THEN ARRAY['owner']
    WHEN 'unfinalize_results' THEN ARRAY[]::TEXT[]  -- admin only (handled above)
    WHEN 'publish_results' THEN ARRAY['owner', 'organizer']
    WHEN 'manage_leaderboard_tokens' THEN ARRAY['owner', 'organizer', 'head_judge']
    ELSE NULL
  END;

  IF v_roles IS NULL THEN
    RETURN false;
  END IF;

  IF array_length(v_roles, 1) IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM event_staff_roles r
    WHERE r.event_id = p_event_id
      AND r.account_id::text = auth.uid()::text
      AND r.role = ANY (v_roles)
      AND r.revoked_at IS NULL
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE event_staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_staff_role_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event staff select own event or admin" ON event_staff_roles;
CREATE POLICY "Event staff select own event or admin"
  ON event_staff_roles FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR account_id::text = auth.uid()::text
    OR has_event_capability(event_id, 'view_ops')
  );

-- Mutations via service role after server auth (Slice 1); admin can manage via RLS
DROP POLICY IF EXISTS "Event staff admin manage" ON event_staff_roles;
CREATE POLICY "Event staff admin manage"
  ON event_staff_roles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Event staff audit select" ON event_staff_role_audit;
CREATE POLICY "Event staff audit select"
  ON event_staff_role_audit FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR has_event_capability(event_id, 'view_ops')
  );

DROP POLICY IF EXISTS "Event staff audit admin insert" ON event_staff_role_audit;
CREATE POLICY "Event staff audit admin insert"
  ON event_staff_role_audit FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());
