-- Sample judge scores for Spring Regional Championship 2026 - 1A - Single String
-- Use this to test the Head Judge Visualiser (charts, outliers).
-- Run AFTER seed_sample_data.sql.
--
-- 1. Sets judge01 as head judge for 1A - Single String.
-- 2. Inserts scores for all 4 judges × 14 participants with realistic spread
--    (some variance and a few outliers for visualiser testing).

DO $$
DECLARE
  div_1a_id UUID;
  part_rec RECORD;
  judge_rec RECORD;
  j1_id UUID;
  j2_id UUID;
  j3_id UUID;
  j4_id UUID;
  -- Score components (we set totals directly; ex_* chosen to match)
  tec DECIMAL(8,2);
  perf DECIMAL(8,2);
  tot DECIMAL(8,2);
  ex_clicks INT;
  ex_ded INT;
BEGIN
  SELECT id INTO div_1a_id
  FROM divisions d
  JOIN events e ON e.id = d.event_id
  WHERE e.name = 'Spring Regional Championship 2026' AND d.name = '1A - Single String'
  LIMIT 1;

  IF div_1a_id IS NULL THEN
    RAISE EXCEPTION 'Division "1A - Single String" for Spring Regional Championship 2026 not found. Run seed_sample_data.sql first.';
  END IF;

  -- Set judge01 as head judge for this division
  UPDATE division_judges
  SET judge_type = 'head'
  WHERE division_id = div_1a_id
    AND member_id = (SELECT id FROM members WHERE email = 'judge01@example.com' LIMIT 1);

  -- Get judge IDs (judge01=head, judge02-04=general)
  SELECT id INTO j1_id FROM members WHERE email = 'judge01@example.com' LIMIT 1;
  SELECT id INTO j2_id FROM members WHERE email = 'judge02@example.com' LIMIT 1;
  SELECT id INTO j3_id FROM members WHERE email = 'judge03@example.com' LIMIT 1;
  SELECT id INTO j4_id FROM members WHERE email = 'judge04@example.com' LIMIT 1;

  -- Insert scores per participant and judge with varied totals (and one draft for testing)
  -- Participant play_order 1-14. We'll give each participant 4 scores with slight variance.
  -- Totals: Judge1 ~84, Judge2 ~82, Judge3 ~86, Judge4 ~80. One outlier: part 5 Judge4 = 72, part 10 Judge3 = 94.
  FOR part_rec IN
    SELECT dm.id AS dm_id, dm.play_order
    FROM division_members dm
    WHERE dm.division_id = div_1a_id
    ORDER BY dm.play_order
  LOOP
    -- Judge 1: base ~84
    tot := 82 + (part_rec.play_order % 5);  -- 82-86
    IF part_rec.play_order = 10 THEN tot := 94; END IF;  -- outlier high
    tec := ROUND((tot * 0.42)::numeric, 2);
    perf := ROUND((tot * 0.58)::numeric, 2);
    ex_clicks := 80 + (part_rec.play_order * 3);
    ex_ded := 0;
    INSERT INTO scores (
      division_id, division_member_id, judge_id,
      ex_clicks, ex_pv, ex_ch, ex_cons, ex_space, ex_body, ex_showman, ex_music, ex_construct, ex_trick_div, ex_deductions,
      technical_score, performance_score, total_score, is_submitted, submitted_at, updated_at
    ) VALUES (
      div_1a_id, part_rec.dm_id, j1_id,
      ex_clicks, 8, 8, 8, 7, 7, 7, 7, 7, 7, ex_ded,
      tec, perf, tot, true, NOW(), NOW()
    ) ON CONFLICT (division_member_id, judge_id) DO UPDATE SET
      technical_score = EXCLUDED.technical_score, performance_score = EXCLUDED.performance_score, total_score = EXCLUDED.total_score,
      is_submitted = true, submitted_at = NOW(), updated_at = NOW();

    -- Judge 2: base ~82
    tot := 80 + (part_rec.play_order % 4);
    tec := ROUND((tot * 0.42)::numeric, 2);
    perf := ROUND((tot * 0.58)::numeric, 2);
    INSERT INTO scores (
      division_id, division_member_id, judge_id,
      ex_clicks, ex_pv, ex_ch, ex_cons, ex_space, ex_body, ex_showman, ex_music, ex_construct, ex_trick_div, ex_deductions,
      technical_score, performance_score, total_score, is_submitted, submitted_at, updated_at
    ) VALUES (
      div_1a_id, part_rec.dm_id, j2_id,
      ex_clicks, 7.5, 7.5, 7.5, 7, 7, 7, 7, 7, 7, 0,
      tec, perf, tot, true, NOW(), NOW()
    ) ON CONFLICT (division_member_id, judge_id) DO UPDATE SET
      technical_score = EXCLUDED.technical_score, performance_score = EXCLUDED.performance_score, total_score = EXCLUDED.total_score,
      is_submitted = true, submitted_at = NOW(), updated_at = NOW();

    -- Judge 3: base ~86 (slightly higher)
    tot := 84 + (part_rec.play_order % 4);
    IF part_rec.play_order = 10 THEN tot := 94; END IF;
    tec := ROUND((tot * 0.42)::numeric, 2);
    perf := ROUND((tot * 0.58)::numeric, 2);
    INSERT INTO scores (
      division_id, division_member_id, judge_id,
      ex_clicks, ex_pv, ex_ch, ex_cons, ex_space, ex_body, ex_showman, ex_music, ex_construct, ex_trick_div, ex_deductions,
      technical_score, performance_score, total_score, is_submitted, submitted_at, updated_at
    ) VALUES (
      div_1a_id, part_rec.dm_id, j3_id,
      ex_clicks, 8.5, 8.5, 8, 8, 8, 8, 8, 8, 8, 0,
      tec, perf, tot, true, NOW(), NOW()
    ) ON CONFLICT (division_member_id, judge_id) DO UPDATE SET
      technical_score = EXCLUDED.technical_score, performance_score = EXCLUDED.performance_score, total_score = EXCLUDED.total_score,
      is_submitted = true, submitted_at = NOW(), updated_at = NOW();

    -- Judge 4: base ~79, one outlier low for participant 5
    tot := 78 + (part_rec.play_order % 4);
    IF part_rec.play_order = 5 THEN tot := 72; END IF;
    tec := ROUND((tot * 0.42)::numeric, 2);
    perf := ROUND((tot * 0.58)::numeric, 2);
    INSERT INTO scores (
      division_id, division_member_id, judge_id,
      ex_clicks, ex_pv, ex_ch, ex_cons, ex_space, ex_body, ex_showman, ex_music, ex_construct, ex_trick_div, ex_deductions,
      technical_score, performance_score, total_score, is_submitted, submitted_at, updated_at
    ) VALUES (
      div_1a_id, part_rec.dm_id, j4_id,
      ex_clicks, 7, 7, 7, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 0,
      tec, perf, tot, true, NOW(), NOW()
    ) ON CONFLICT (division_member_id, judge_id) DO UPDATE SET
      technical_score = EXCLUDED.technical_score, performance_score = EXCLUDED.performance_score, total_score = EXCLUDED.total_score,
      is_submitted = true, submitted_at = NOW(), updated_at = NOW();
  END LOOP;

  -- One draft score (participant 1, judge 4) so "Including draft scores" banner can appear
  UPDATE scores s
  SET is_submitted = false, submitted_at = NULL, updated_at = NOW()
  FROM division_members dm
  WHERE s.division_member_id = dm.id AND s.judge_id = j4_id AND dm.division_id = div_1a_id AND dm.play_order = 1;

  RAISE NOTICE '1A - Single String: head judge set (judge01), sample scores inserted (14 participants × 4 judges, 1 draft).';
END $$;
