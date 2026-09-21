-- Regional feeds National Race only; Nationals feed both National + World Race.
-- Apply after 007 (or after 006 if 007 not yet applied — ADD COLUMN IF NOT EXISTS is safe).

ALTER TABLE event_tiers
  ADD COLUMN IF NOT EXISTS counts_for_world_race BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE event_tiers
  ADD COLUMN IF NOT EXISTS counts_for_national_race BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN event_tiers.counts_for_national_race IS
  'When true, event points count toward National Race (regionals + home nationals).';

-- Local / State: Custom League only
UPDATE event_tiers SET
  name = 'Local / Club (Custom League only)',
  counts_for_world_race = false,
  counts_for_national_race = false
WHERE code = 'LOCAL';

UPDATE event_tiers SET
  name = 'State (Custom League only)',
  counts_for_world_race = false,
  counts_for_national_race = false
WHERE code = 'STATE';

-- Regional → National Race only
UPDATE event_tiers SET
  multiplier = 2.00,
  sort_order = 30,
  name = 'Regional (National Race)',
  counts_for_world_race = false,
  counts_for_national_race = true
WHERE code = 'REGIONAL';

-- National → both races
UPDATE event_tiers SET
  multiplier = 3.00,
  sort_order = 40,
  name = 'National',
  counts_for_world_race = true,
  counts_for_national_race = true
WHERE code = 'NATIONAL';

-- Continental / World → World Race only (not a single-country National Race)
UPDATE event_tiers SET
  multiplier = 4.00,
  sort_order = 50,
  name = 'Continental (AP / EYYC)',
  counts_for_world_race = true,
  counts_for_national_race = false
WHERE code = 'CONTINENTAL';

UPDATE event_tiers SET
  multiplier = 5.00,
  sort_order = 60,
  name = 'World',
  counts_for_world_race = true,
  counts_for_national_race = false
WHERE code = 'WORLD';

INSERT INTO event_tiers (code, name, multiplier, sort_order, counts_for_world_race, counts_for_national_race)
VALUES ('CONTINENTAL', 'Continental (AP / EYYC)', 4.00, 50, true, false)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  multiplier = EXCLUDED.multiplier,
  sort_order = EXCLUDED.sort_order,
  counts_for_world_race = EXCLUDED.counts_for_world_race,
  counts_for_national_race = EXCLUDED.counts_for_national_race;
