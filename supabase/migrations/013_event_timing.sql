-- Prompt 4: Rich event timing and registration windows (additive)
-- Keep event_date; backfill starts_at from it. Do not drop event_date.
-- Rollback: ALTER TABLE events DROP COLUMN IF EXISTS for each new column below.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS registration_opens_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS music_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_in_opens_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_in_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS organizer_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS organizer_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS organizer_contact_public BOOLEAN NOT NULL DEFAULT false;

-- Backfill starts_at from event_date (noon UTC) when missing
UPDATE events
SET starts_at = (event_date::timestamp + TIME '12:00') AT TIME ZONE 'UTC'
WHERE event_date IS NOT NULL
  AND starts_at IS NULL;

UPDATE events
SET timezone = COALESCE(NULLIF(timezone, ''), 'UTC')
WHERE timezone IS NULL OR timezone = '';

-- Soft check constraints (NOT VALID so existing odd rows don't block apply;
-- new writes still validated in app)
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_starts_before_ends;
ALTER TABLE events
  ADD CONSTRAINT events_starts_before_ends
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
  NOT VALID;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_reg_window_order;
ALTER TABLE events
  ADD CONSTRAINT events_reg_window_order
  CHECK (
    registration_opens_at IS NULL
    OR registration_closes_at IS NULL
    OR registration_opens_at < registration_closes_at
  )
  NOT VALID;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_checkin_window_order;
ALTER TABLE events
  ADD CONSTRAINT events_checkin_window_order
  CHECK (
    check_in_opens_at IS NULL
    OR check_in_closes_at IS NULL
    OR check_in_opens_at < check_in_closes_at
  )
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_registration_closes_at ON events(registration_closes_at);
