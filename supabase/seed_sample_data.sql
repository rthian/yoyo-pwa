-- Sample Data for YoYo Event Management System
-- Run this SQL in your Supabase SQL Editor to populate test data
-- 
-- Prerequisites: 
-- 1. Run setup_complete.sql first (or schema.sql + migrations)
-- 2. Have at least one admin user already created
--
-- This seed will create:
-- - 19 Players (Player 02 - Player 20) with AUTH accounts (password: player123)
-- - 10 Judges (Judge 01 - Judge 10) with AUTH accounts (password: judge123)
-- - 3 Events with different rulesets and configurations
-- - Multiple divisions per event with different scoring types
-- - Schedule entries for each event
-- - Player registrations and judge assignments
--
-- LOGIN CREDENTIALS:
-- Players: player02@example.com through player20@example.com / player123
-- Judges:  judge01@example.com through judge10@example.com / judge123

-- ============================================
-- SAFETY CHECK: Prevent duplicate runs
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM events WHERE name = 'Spring Regional Championship 2026') THEN
    RAISE EXCEPTION 'Sample data already exists! Clear the database first or use a fresh instance.';
  END IF;
END $$;

-- ============================================
-- MEMBERS WITH AUTH ACCOUNTS
-- Creates both auth.users + members records with matching IDs
-- ============================================

DO $$
DECLARE
  player_ids UUID[] := ARRAY[]::UUID[];
  judge_ids UUID[] := ARRAY[]::UUID[];
  new_id UUID;
  i INT;
  
  -- Player data arrays (email, full_name, nickname, country)
  player_emails TEXT[] := ARRAY[
    'player02@example.com', 'player03@example.com', 'player04@example.com', 'player05@example.com',
    'player06@example.com', 'player07@example.com', 'player08@example.com', 'player09@example.com',
    'player10@example.com', 'player11@example.com', 'player12@example.com', 'player13@example.com',
    'player14@example.com', 'player15@example.com', 'player16@example.com', 'player17@example.com',
    'player18@example.com', 'player19@example.com', 'player20@example.com'
  ];
  player_names TEXT[] := ARRAY[
    'Tyler Mitchell', 'Sarah Chen', 'Marcus Johnson', 'Emma Rodriguez',
    'Takeshi Yamamoto', 'Yuki Nakamura', 'Haruto Tanaka', 'Aiko Suzuki',
    'Lucas Dubois', 'Sofia Kowalski', 'Oliver Schmidt', 'Isabella Rossi',
    'Kim Min-jun', 'Chen Wei', 'Nguyen Anh', 'Priya Sharma',
    'Diego Martinez', 'Zara Al-Hassan', 'Liam O''Connor'
  ];
  player_nicknames TEXT[] := ARRAY[
    'T-Spin', 'Lunar', 'MJ', 'Stellar',
    'Yama', 'Snow Dragon', 'Haru', 'Phoenix',
    'Lucky', 'Sofi', 'Oli', 'Bella',
    'Thunder', 'Gravity', 'Flash', 'Spin Master',
    'El Maestro', 'Desert Rose', 'Lucky Liam'
  ];
  player_countries TEXT[] := ARRAY[
    'USA', 'USA', 'USA', 'USA',
    'Japan', 'Japan', 'Japan', 'Japan',
    'France', 'Poland', 'Germany', 'Italy',
    'South Korea', 'China', 'Vietnam', 'India',
    'Mexico', 'UAE', 'Ireland'
  ];
  
  -- Judge data arrays
  judge_emails TEXT[] := ARRAY[
    'judge01@example.com', 'judge02@example.com', 'judge03@example.com', 'judge04@example.com',
    'judge05@example.com', 'judge06@example.com', 'judge07@example.com', 'judge08@example.com',
    'judge09@example.com', 'judge10@example.com'
  ];
  judge_names TEXT[] := ARRAY[
    'Rebecca Williams', 'Hiroshi Nakamura', 'Maria Santos', 'David Lee',
    'Anna Petrov', 'Carlos Gomez', 'Lisa Anderson', 'Thomas Müller',
    'Jin Park', 'Sophie Laurent'
  ];
  judge_nicknames TEXT[] := ARRAY[
    'Judge Becca', 'Judge Hiro', 'Judge Maria', 'Judge Dave',
    'Judge Anna', 'Judge Carlos', 'Judge Lisa', 'Judge Tom',
    'Judge Jin', 'Judge Sophie'
  ];
  judge_countries TEXT[] := ARRAY[
    'USA', 'Japan', 'Brazil', 'Canada',
    'Russia', 'Spain', 'Australia', 'Germany',
    'South Korea', 'France'
  ];

BEGIN
  -- ============================================
  -- CREATE PLAYERS (Player 02 - Player 20)
  -- Password: player123
  -- ============================================
  FOR i IN 1..array_length(player_emails, 1) LOOP
    -- Skip if auth user already exists with this email
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = player_emails[i]) THEN
      new_id := gen_random_uuid();
      
      -- Create auth user
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        new_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        player_emails[i],
        crypt('player123', gen_salt('bf')),
        NOW(), NOW(), NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', player_names[i]),
        '', '', '', ''
      );
      
      -- Create identity record for email login
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        new_id,
        jsonb_build_object('sub', new_id::text, 'email', player_emails[i]),
        'email',
        new_id::text,
        NOW(), NOW(), NOW()
      );
      
      -- Create member record with matching ID
      INSERT INTO members (id, email, full_name, nickname, role, country, is_active)
      VALUES (new_id, player_emails[i], player_names[i], player_nicknames[i], 'member', player_countries[i], true)
      ON CONFLICT (email) DO UPDATE SET id = new_id;
      
      player_ids := array_append(player_ids, new_id);
    ELSE
      -- If auth user exists, just ensure member record exists
      SELECT id INTO new_id FROM auth.users WHERE email = player_emails[i];
      INSERT INTO members (id, email, full_name, nickname, role, country, is_active)
      VALUES (new_id, player_emails[i], player_names[i], player_nicknames[i], 'member', player_countries[i], true)
      ON CONFLICT (email) DO NOTHING;
      player_ids := array_append(player_ids, new_id);
    END IF;
  END LOOP;

  RAISE NOTICE 'Created % player accounts', array_length(player_ids, 1);

  -- ============================================
  -- CREATE JUDGES (Judge 01 - Judge 10)
  -- Password: judge123
  -- ============================================
  FOR i IN 1..array_length(judge_emails, 1) LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = judge_emails[i]) THEN
      new_id := gen_random_uuid();
      
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        new_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        judge_emails[i],
        crypt('judge123', gen_salt('bf')),
        NOW(), NOW(), NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', judge_names[i]),
        '', '', '', ''
      );
      
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        new_id,
        jsonb_build_object('sub', new_id::text, 'email', judge_emails[i]),
        'email',
        new_id::text,
        NOW(), NOW(), NOW()
      );
      
      INSERT INTO members (id, email, full_name, nickname, role, country, is_active)
      VALUES (new_id, judge_emails[i], judge_names[i], judge_nicknames[i], 'judge', judge_countries[i], true)
      ON CONFLICT (email) DO UPDATE SET id = new_id;
      
      judge_ids := array_append(judge_ids, new_id);
    ELSE
      SELECT id INTO new_id FROM auth.users WHERE email = judge_emails[i];
      INSERT INTO members (id, email, full_name, nickname, role, country, is_active)
      VALUES (new_id, judge_emails[i], judge_names[i], judge_nicknames[i], 'judge', judge_countries[i], true)
      ON CONFLICT (email) DO NOTHING;
      judge_ids := array_append(judge_ids, new_id);
    END IF;
  END LOOP;

  RAISE NOTICE 'Created % judge accounts', array_length(judge_ids, 1);
END $$;

-- ============================================
-- EVENT 1: Spring Regional Championship 2026
-- Using default RULE_00, mixed scoring types
-- ============================================

-- Get the RULE_00 ruleset ID
WITH rule_00 AS (
  SELECT id FROM rulesets WHERE code = 'RULE_00' LIMIT 1
)
INSERT INTO events (name, description, location, event_date, status, ruleset_id)
SELECT 
  'Spring Regional Championship 2026',
  'A regional competition showcasing all divisions with traditional scoring. Perfect for testing standard workflows and mixed scoring types.',
  'Convention Center, San Francisco, CA',
  '2026-04-15',
  'active',
  rule_00.id
FROM rule_00;

-- Create divisions and assignments for Event 1
DO $$
DECLARE
  event1_id UUID;
  div_1a_id UUID;
  div_2a_id UUID;
  div_3a_id UUID;
  div_4a_id UUID;
  div_5a_id UUID;
BEGIN
  SELECT id INTO event1_id FROM events WHERE name = 'Spring Regional Championship 2026' LIMIT 1;

  -- Create divisions for Event 1
  INSERT INTO divisions (event_id, name, description, scoring_type, sort_order, is_active, round_type, scheduled_start, scheduled_end, venue)
  VALUES 
    (event1_id, '1A - Single String', 'Traditional single yoyo string tricks', 'standard', 1, true, 'final', '2026-04-15 10:00:00', '2026-04-15 12:00:00', 'Main Stage'),
    (event1_id, '2A - Looping', 'Two handed looping tricks', 'clicker', 2, true, 'final', '2026-04-15 13:00:00', '2026-04-15 14:30:00', 'Main Stage'),
    (event1_id, '3A - Two Handed', 'String tricks with two yoyos', 'standard', 3, true, 'semi_final', '2026-04-15 15:00:00', '2026-04-15 16:30:00', 'Secondary Stage'),
    (event1_id, '4A - Offstring', 'Offstring freestyle tricks', 'clicker', 4, true, 'qualifier', '2026-04-15 17:00:00', '2026-04-15 18:00:00', 'Main Stage'),
    (event1_id, '5A - Counterweight', 'Counterweight freestyle', 'head_to_head', 5, true, 'exhibition', '2026-04-15 19:00:00', '2026-04-15 20:00:00', 'Main Stage');

  -- Get division IDs
  SELECT id INTO div_1a_id FROM divisions WHERE event_id = event1_id AND name = '1A - Single String' LIMIT 1;
  SELECT id INTO div_2a_id FROM divisions WHERE event_id = event1_id AND name = '2A - Looping' LIMIT 1;
  SELECT id INTO div_3a_id FROM divisions WHERE event_id = event1_id AND name = '3A - Two Handed' LIMIT 1;
  SELECT id INTO div_4a_id FROM divisions WHERE event_id = event1_id AND name = '4A - Offstring' LIMIT 1;
  SELECT id INTO div_5a_id FROM divisions WHERE event_id = event1_id AND name = '5A - Counterweight' LIMIT 1;

  -- Add schedule entries for Event 1
  INSERT INTO schedule_entries (event_id, title, description, entry_type, scheduled_start, scheduled_end, venue, sort_order)
  VALUES
    (event1_id, 'Opening Ceremony', 'Welcome and competition rules briefing', 'ceremony', '2026-04-15 09:00:00', '2026-04-15 09:45:00', 'Main Hall', 1),
    (event1_id, 'Lunch Break', 'Food trucks and vendor area open', 'break', '2026-04-15 12:00:00', '2026-04-15 13:00:00', 'Outside Plaza', 2),
    (event1_id, 'Registration Desk', 'Late registration and check-in available', 'registration', '2026-04-15 08:00:00', '2026-04-15 09:30:00', 'Lobby', 0),
    (event1_id, 'Awards Ceremony', 'Trophy presentation for all divisions', 'ceremony', '2026-04-15 20:30:00', '2026-04-15 21:30:00', 'Main Stage', 3);

  -- Register players to divisions (1A gets most, others get fewer)
  -- 1A: Players 2-15 (14 players)
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_1a_id, id, ROW_NUMBER() OVER (ORDER BY full_name), 'checked_in'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player02@example.com', 'player03@example.com', 'player04@example.com', 'player05@example.com',
    'player06@example.com', 'player07@example.com', 'player08@example.com', 'player09@example.com',
    'player10@example.com', 'player11@example.com', 'player12@example.com', 'player13@example.com',
    'player14@example.com', 'player15@example.com'
  );

  -- 2A: Players 2, 4, 6, 8, 10, 12 (6 players)
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_2a_id, id, ROW_NUMBER() OVER (ORDER BY full_name), 'registered'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player02@example.com', 'player04@example.com', 'player06@example.com',
    'player08@example.com', 'player10@example.com', 'player12@example.com'
  );

  -- 3A: Players 3, 6, 9, 12, 15, 18 (6 players)
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_3a_id, id, ROW_NUMBER() OVER (ORDER BY full_name), 'registered'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player03@example.com', 'player06@example.com', 'player09@example.com',
    'player12@example.com', 'player15@example.com', 'player18@example.com'
  );

  -- 4A: Players 5, 10, 15, 20 (4 players)
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_4a_id, id, ROW_NUMBER() OVER (ORDER BY full_name), 'registered'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player05@example.com', 'player10@example.com', 'player15@example.com', 'player20@example.com'
  );

  -- 5A: Players 7, 14, 16, 19 (4 players)
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_5a_id, id, ROW_NUMBER() OVER (ORDER BY full_name), 'registered'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player07@example.com', 'player14@example.com', 'player16@example.com', 'player19@example.com'
  );

  -- Assign judges to divisions
  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_1a_id, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge01@example.com', 'judge02@example.com', 'judge03@example.com', 'judge04@example.com');

  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_2a_id, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge05@example.com', 'judge06@example.com');

  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_3a_id, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge07@example.com', 'judge08@example.com', 'judge09@example.com');

  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_4a_id, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge10@example.com', 'judge01@example.com');

  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_5a_id, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge02@example.com', 'judge03@example.com');
END $$;

-- ============================================
-- EVENT 2: IYYF World Championship Trial 2026
-- Using IYYF-WYYC-25 rules with full round structure
-- ============================================

DO $$
DECLARE
  event2_id UUID;
  iyyf_ruleset_id UUID;
  div_prelim_id UUID;
  div_semi_id UUID;
  div_final_id UUID;
BEGIN
  SELECT id INTO iyyf_ruleset_id FROM rulesets WHERE code = 'IYYF_WYYC_25' LIMIT 1;

  INSERT INTO events (name, description, location, event_date, status, ruleset_id)
  VALUES (
    'IYYF World Championship Trial 2026',
    'Official trial event following IYYF World Yo-Yo Contest 2025 rules. Features preliminary, semi-final, and final rounds with IYYF scoring structure.',
    'Tokyo Big Sight, Tokyo, Japan',
    '2026-06-20',
    'published',
    iyyf_ruleset_id
  )
  RETURNING id INTO event2_id;

  INSERT INTO divisions (event_id, name, description, scoring_type, sort_order, is_active, round_type, scheduled_start, scheduled_end, venue)
  VALUES 
    (event2_id, '1A Preliminary', 'First round - 1 minute freestyle', 'clicker', 1, true, 'qualifier', '2026-06-20 10:00:00', '2026-06-20 12:30:00', 'Arena A'),
    (event2_id, '1A Semi-Final', 'Second round - 90 second freestyle', 'clicker', 2, true, 'semi_final', '2026-06-20 14:00:00', '2026-06-20 16:00:00', 'Arena A'),
    (event2_id, '1A Final', 'Championship round - 3 minute freestyle', 'clicker', 3, true, 'final', '2026-06-20 18:00:00', '2026-06-20 20:00:00', 'Main Stage');

  SELECT id INTO div_prelim_id FROM divisions WHERE event_id = event2_id AND name = '1A Preliminary' LIMIT 1;
  SELECT id INTO div_semi_id FROM divisions WHERE event_id = event2_id AND name = '1A Semi-Final' LIMIT 1;
  SELECT id INTO div_final_id FROM divisions WHERE event_id = event2_id AND name = '1A Final' LIMIT 1;

  INSERT INTO schedule_entries (event_id, title, description, entry_type, scheduled_start, scheduled_end, venue, sort_order)
  VALUES
    (event2_id, 'Competitor Registration', 'Check-in and credential pickup', 'registration', '2026-06-20 08:00:00', '2026-06-20 09:45:00', 'Entrance Hall', 0),
    (event2_id, 'Opening Ceremony', 'Welcome address and IYYF rules overview', 'ceremony', '2026-06-20 09:00:00', '2026-06-20 09:50:00', 'Main Stage', 1),
    (event2_id, 'Lunch Break', 'Catering available in dining area', 'break', '2026-06-20 12:30:00', '2026-06-20 14:00:00', 'Dining Hall', 2),
    (event2_id, 'Afternoon Break', 'Refreshments and vendor showcase', 'break', '2026-06-20 16:00:00', '2026-06-20 17:00:00', 'Vendor Area', 3),
    (event2_id, 'Finals Ceremony', 'Medal presentation and photo session', 'ceremony', '2026-06-20 20:00:00', '2026-06-20 21:00:00', 'Main Stage', 4);

  -- Register all players to Preliminary
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_prelim_id, id, ROW_NUMBER() OVER (ORDER BY full_name), 'checked_in'
  FROM members 
  WHERE role = 'member' AND email LIKE 'player%@example.com';

  -- Top 10 advance to Semi-Final
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_semi_id, id, ROW_NUMBER() OVER (ORDER BY full_name), 'registered'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player02@example.com', 'player03@example.com', 'player06@example.com', 'player07@example.com',
    'player10@example.com', 'player11@example.com', 'player14@example.com', 'player15@example.com',
    'player18@example.com', 'player19@example.com'
  );

  -- Top 5 advance to Final
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_final_id, id, ROW_NUMBER() OVER (ORDER BY full_name), 'registered'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player06@example.com', 'player07@example.com', 'player14@example.com', 'player15@example.com', 'player19@example.com'
  );

  -- Assign judges
  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_prelim_id, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge01@example.com', 'judge02@example.com', 'judge03@example.com');

  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_semi_id, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge04@example.com', 'judge05@example.com', 'judge06@example.com', 'judge07@example.com');

  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_final_id, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge01@example.com', 'judge08@example.com', 'judge09@example.com', 'judge10@example.com', 'judge02@example.com');
END $$;

-- ============================================
-- EVENT 3: AP Summer Open 2026
-- Using AP-26 rules with 50/50 TE/PE split
-- ============================================

DO $$
DECLARE
  event3_id UUID;
  ap_ruleset_id UUID;
  div_1a_prelim UUID;
  div_1a_semi UUID;
  div_1a_final UUID;
  div_2a UUID;
  div_5a UUID;
BEGIN
  SELECT id INTO ap_ruleset_id FROM rulesets WHERE code = 'AP_26' LIMIT 1;

  INSERT INTO events (name, description, location, event_date, status, ruleset_id)
  VALUES (
    'AP Summer Open 2026',
    'Competition using AP Yo-Yo Open 2026 rules featuring 50/50 TE/PE scoring split with 5 Performance Evaluation categories. A modern take on yo-yo competition.',
    'Sydney Convention Centre, Sydney, Australia',
    '2026-08-10',
    'published',
    ap_ruleset_id
  )
  RETURNING id INTO event3_id;

  INSERT INTO divisions (event_id, name, description, scoring_type, sort_order, is_active, round_type, scheduled_start, scheduled_end, venue)
  VALUES 
    (event3_id, '1A Prelim', 'Preliminary - 1 minute', 'clicker', 1, true, 'qualifier', '2026-08-10 10:00:00', '2026-08-10 11:30:00', 'Stage 1'),
    (event3_id, '1A Semi-Final', 'Semi-Final - 1.5 minutes', 'clicker', 2, true, 'semi_final', '2026-08-10 13:00:00', '2026-08-10 14:30:00', 'Stage 1'),
    (event3_id, '1A Final', 'Final - 3 minutes', 'clicker', 3, true, 'final', '2026-08-10 16:00:00', '2026-08-10 18:00:00', 'Main Arena'),
    (event3_id, '2A Final', '2A Championship', 'clicker', 4, true, 'final', '2026-08-10 11:00:00', '2026-08-10 12:00:00', 'Stage 2'),
    (event3_id, '5A Final', '5A Championship', 'clicker', 5, true, 'final', '2026-08-10 14:00:00', '2026-08-10 15:00:00', 'Stage 2');

  SELECT id INTO div_1a_prelim FROM divisions WHERE event_id = event3_id AND name = '1A Prelim' LIMIT 1;
  SELECT id INTO div_1a_semi FROM divisions WHERE event_id = event3_id AND name = '1A Semi-Final' LIMIT 1;
  SELECT id INTO div_1a_final FROM divisions WHERE event_id = event3_id AND name = '1A Final' LIMIT 1;
  SELECT id INTO div_2a FROM divisions WHERE event_id = event3_id AND name = '2A Final' LIMIT 1;
  SELECT id INTO div_5a FROM divisions WHERE event_id = event3_id AND name = '5A Final' LIMIT 1;

  INSERT INTO schedule_entries (event_id, title, description, entry_type, scheduled_start, scheduled_end, venue, sort_order)
  VALUES
    (event3_id, 'Registration Opens', 'Competitor check-in and registration', 'registration', '2026-08-10 08:30:00', '2026-08-10 09:45:00', 'Front Desk', 0),
    (event3_id, 'Morning Coffee Break', 'Coffee and light refreshments', 'break', '2026-08-10 11:30:00', '2026-08-10 12:00:00', 'Lounge', 1),
    (event3_id, 'Lunch Break', 'Food court open', 'break', '2026-08-10 12:00:00', '2026-08-10 13:00:00', 'Food Court', 2),
    (event3_id, 'Afternoon Break', 'Meet and greet with pros', 'break', '2026-08-10 15:00:00', '2026-08-10 16:00:00', 'Exhibition Hall', 3),
    (event3_id, 'Awards Ceremony', 'Trophy and prize distribution', 'ceremony', '2026-08-10 18:00:00', '2026-08-10 19:00:00', 'Main Arena', 4);

  -- 1A Prelim: 16 players
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_1a_prelim, id, ROW_NUMBER() OVER (ORDER BY full_name), 'checked_in'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player02@example.com', 'player03@example.com', 'player04@example.com', 'player05@example.com',
    'player06@example.com', 'player07@example.com', 'player08@example.com', 'player09@example.com',
    'player10@example.com', 'player11@example.com', 'player12@example.com', 'player13@example.com',
    'player14@example.com', 'player15@example.com', 'player16@example.com', 'player17@example.com'
  );

  -- 1A Semi: 8 players
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_1a_semi, id, ROW_NUMBER() OVER (ORDER BY full_name), 'registered'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player03@example.com', 'player05@example.com', 'player07@example.com', 'player09@example.com',
    'player11@example.com', 'player13@example.com', 'player15@example.com', 'player17@example.com'
  );

  -- 1A Final: 5 players
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_1a_final, id, ROW_NUMBER() OVER (ORDER BY full_name), 'registered'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player06@example.com', 'player08@example.com', 'player12@example.com', 'player14@example.com', 'player16@example.com'
  );

  -- 2A Final: 5 players
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_2a, id, ROW_NUMBER() OVER (ORDER BY full_name), 'registered'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player04@example.com', 'player08@example.com', 'player12@example.com', 'player18@example.com', 'player20@example.com'
  );

  -- 5A Final: 4 players
  INSERT INTO division_members (division_id, member_id, play_order, status)
  SELECT div_5a, id, ROW_NUMBER() OVER (ORDER BY full_name), 'registered'
  FROM members 
  WHERE role = 'member' AND email IN (
    'player07@example.com', 'player14@example.com', 'player19@example.com', 'player20@example.com'
  );

  -- Assign judges
  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_1a_prelim, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge01@example.com', 'judge02@example.com', 'judge03@example.com');

  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_1a_semi, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge04@example.com', 'judge05@example.com', 'judge06@example.com', 'judge07@example.com');

  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_1a_final, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge08@example.com', 'judge09@example.com', 'judge10@example.com', 'judge01@example.com', 'judge02@example.com');

  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_2a, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge03@example.com', 'judge04@example.com', 'judge05@example.com');

  INSERT INTO division_judges (division_id, member_id, judge_type)
  SELECT div_5a, id, 'general'
  FROM members 
  WHERE role = 'judge' AND email IN ('judge06@example.com', 'judge07@example.com', 'judge08@example.com');
END $$;

-- ============================================
-- LEADERBOARD TOKENS (Public share links for all divisions)
-- ============================================
-- Generate a leaderboard token for every division so they appear on the public leaderboards page.
-- Uses the admin member (first admin) as creator.
INSERT INTO leaderboard_tokens (division_id, token, is_active, created_by)
SELECT 
  d.id,
  encode(gen_random_bytes(32), 'hex'),
  true,
  (SELECT id FROM members WHERE role = 'admin' LIMIT 1)
FROM divisions d
JOIN events e ON d.event_id = e.id
WHERE e.status IN ('active', 'published')
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

SELECT 
  role,
  COUNT(*) as count
FROM members
GROUP BY role
ORDER BY role;

SELECT 
  e.name,
  e.status,
  e.event_date,
  r.name as ruleset_name,
  r.code as ruleset_code
FROM events e
LEFT JOIN rulesets r ON e.ruleset_id = r.id
ORDER BY e.event_date;

SELECT 
  e.name as event_name,
  d.name as division_name,
  d.round_type,
  d.scoring_type,
  COUNT(DISTINCT dm.id) as participant_count,
  COUNT(DISTINCT dj.id) as judge_count
FROM events e
LEFT JOIN divisions d ON e.id = d.event_id
LEFT JOIN division_members dm ON d.id = dm.division_id
LEFT JOIN division_judges dj ON d.id = dj.division_id
GROUP BY e.id, e.name, d.id, d.name, d.round_type, d.scoring_type
ORDER BY e.name, d.sort_order;

SELECT 
  'Summary' as info,
  (SELECT COUNT(*) FROM members WHERE role = 'member') as total_players,
  (SELECT COUNT(*) FROM members WHERE role = 'judge') as total_judges,
  (SELECT COUNT(*) FROM events) as total_events,
  (SELECT COUNT(*) FROM divisions) as total_divisions,
  (SELECT COUNT(*) FROM division_members) as total_registrations,
  (SELECT COUNT(*) FROM schedule_entries) as total_schedule_entries;

-- ============================================
-- LOGIN CREDENTIALS REMINDER
-- ============================================
-- Players: player02@example.com - player20@example.com / password: player123
-- Judges:  judge01@example.com - judge10@example.com  / password: judge123
