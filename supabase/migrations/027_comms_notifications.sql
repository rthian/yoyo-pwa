-- Prompt 22: notification preferences + comms outbox + blast audit.
-- Rollback: DROP TABLE event_comms_log, comms_outbox, notification_preferences;

CREATE TABLE IF NOT EXISTS notification_preferences (
  account_id UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  email_payment_reminders BOOLEAN NOT NULL DEFAULT true,
  email_event_countdown BOOLEAN NOT NULL DEFAULT true,
  email_organizer_blasts BOOLEAN NOT NULL DEFAULT true,
  email_results_and_rankings BOOLEAN NOT NULL DEFAULT true,
  email_staff_ops BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comms_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(64) NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  recipient_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  idempotency_key TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_comms_outbox_due
  ON comms_outbox(status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_comms_outbox_event
  ON comms_outbox(event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS event_comms_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actor_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  segment VARCHAR(64) NOT NULL,
  subject TEXT NOT NULL,
  body_preview TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  outbox_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_comms_log_event
  ON event_comms_log(event_id, created_at DESC);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_comms_log ENABLE ROW LEVEL SECURITY;

-- APIs use service role; minimal own-read policies for prefs.
DROP POLICY IF EXISTS notification_preferences_own ON notification_preferences;
CREATE POLICY notification_preferences_own ON notification_preferences
  FOR ALL
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());
