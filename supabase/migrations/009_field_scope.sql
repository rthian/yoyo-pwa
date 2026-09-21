-- Championship vs invitational field scope (IYYF NC vs International Open).
-- National Race counts championship only; World Race counts both.
-- Apply after 008.

ALTER TABLE divisions
  ADD COLUMN IF NOT EXISTS field_scope VARCHAR(20) NOT NULL DEFAULT 'championship';

DO $$ BEGIN
  ALTER TABLE divisions ADD CONSTRAINT divisions_field_scope_check
    CHECK (field_scope IN ('championship', 'invitational'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ranking_points
  ADD COLUMN IF NOT EXISTS field_scope VARCHAR(20) NOT NULL DEFAULT 'championship';

CREATE INDEX IF NOT EXISTS idx_ranking_points_field_scope
  ON ranking_points (season_id, category_id, field_scope);

COMMENT ON COLUMN divisions.field_scope IS
  'championship = home title / National Race eligible; invitational = International Open etc. (World Race / Custom League).';
COMMENT ON COLUMN ranking_points.field_scope IS
  'Copied from division at finalize. National Race filters to championship.';
