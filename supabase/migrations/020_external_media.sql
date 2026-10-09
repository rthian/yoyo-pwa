-- Prompt 13: External media links (URLs only; embeds in Prompt 15)
-- Applied manually in Supabase SQL Editor (same as 017–019).
-- Callers: lib/media + app/api/events/[id]/media (service role after auth).
-- Sample row: { kind: 'highlight', provider: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Finals highlight', is_public: true, sort_order: 0 }
-- User: "prompt 13"
-- Rollback: DROP TABLE event_external_media;

CREATE TABLE IF NOT EXISTS event_external_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  division_id UUID REFERENCES divisions(id) ON DELETE SET NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'other'
    CHECK (kind IN ('livestream', 'highlight', 'routine', 'photo_album', 'other')),
  provider VARCHAR(32) NOT NULL DEFAULT 'other'
    CHECK (provider IN ('youtube', 'vimeo', 'twitch', 'instagram', 'other')),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_external_media_event
  ON event_external_media(event_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_event_external_media_public
  ON event_external_media(event_id)
  WHERE is_public = true;

DROP TRIGGER IF EXISTS update_event_external_media_updated_at ON event_external_media;
CREATE TRIGGER update_event_external_media_updated_at
  BEFORE UPDATE ON event_external_media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE event_external_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "External media public select" ON event_external_media;
CREATE POLICY "External media public select"
  ON event_external_media FOR SELECT
  TO anon, authenticated
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
        AND e.status IN ('published', 'active', 'completed')
    )
  );

DROP POLICY IF EXISTS "External media staff select" ON event_external_media;
CREATE POLICY "External media staff select"
  ON event_external_media FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR has_event_capability(event_id, 'view_ops')
  );

DROP POLICY IF EXISTS "External media admin manage" ON event_external_media;
CREATE POLICY "External media admin manage"
  ON event_external_media FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
