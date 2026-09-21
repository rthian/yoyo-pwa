-- Season best-N + ensure Continental tier / hierarchy multipliers.
-- Safe to apply AFTER or AFTER 008 (idempotent). 008 owns national/world race flags.
-- If you already applied 008 first: this mainly sets counting_results = 6.

ALTER TABLE event_tiers
  ADD COLUMN IF NOT EXISTS counts_for_world_race BOOLEAN NOT NULL DEFAULT true;

-- Hierarchy multipliers (race flags left to 008 when present)
UPDATE event_tiers SET multiplier = 0.50, sort_order = 10
WHERE code = 'LOCAL';
UPDATE event_tiers SET multiplier = 1.00, sort_order = 20
WHERE code = 'STATE';
UPDATE event_tiers SET multiplier = 2.00, sort_order = 30
WHERE code = 'REGIONAL';
UPDATE event_tiers SET multiplier = 3.00, sort_order = 40
WHERE code = 'NATIONAL';
UPDATE event_tiers SET multiplier = 5.00, sort_order = 60
WHERE code = 'WORLD';

INSERT INTO event_tiers (code, name, multiplier, sort_order, counts_for_world_race) VALUES
  ('CONTINENTAL', 'Continental (AP / EYYC)', 4.00, 50, true)
ON CONFLICT (code) DO UPDATE SET
  multiplier = EXCLUDED.multiplier,
  sort_order = EXCLUDED.sort_order;

-- Best 6 counting results for 2026 / active season
UPDATE seasons
SET counting_results = 6
WHERE slug = '2026' OR is_active = true;
