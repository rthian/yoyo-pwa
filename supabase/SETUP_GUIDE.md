# Database Setup Guide

## Option A: Fresh Database (No existing data)

If you're starting from scratch, run these in order in your Supabase SQL Editor:

1. **`schema.sql`** - Creates all tables, policies, and seed rulesets
2. **`seed_sample_data.sql`** - Adds sample players, judges, and events for testing

## Option B: Existing Database (Has old schema)

If you already have events, members, and divisions in your database:

1. **`migrations/001_add_rulesets_and_schedules.sql`** - Adds new tables and columns
2. **`seed_sample_data.sql`** - Adds sample players, judges, and events for testing

## Option C: Not Sure / Want Safe Approach

Run this single command that works for both fresh and existing databases:

1. **`setup_complete.sql`** - Safe setup script with IF NOT EXISTS checks
2. **`seed_sample_data.sql`** - Adds sample data

---

## After Running Setup

Verify everything worked by running these queries:

```sql
-- Check member counts by role
SELECT role, COUNT(*) 
FROM members 
GROUP BY role 
ORDER BY role;

-- Check events and their rulesets
SELECT 
  e.name,
  e.event_date,
  r.code as ruleset
FROM events e
LEFT JOIN rulesets r ON e.ruleset_id = r.id
ORDER BY e.event_date;

-- Check total divisions
SELECT COUNT(*) as total_divisions FROM divisions;

-- Check total registrations
SELECT COUNT(*) as total_registrations FROM division_members;
```

Expected results:
- Members: ~20 players, ~10 judges, your admin(s)
- Events: 3 events
- Divisions: 13 divisions total
- Registrations: ~100+ total registrations

---

## Troubleshooting

**Error: "relation already exists"**
- You're running the full schema on an existing database
- Use Option B (migration file) instead

**Error: "relation does not exist"**
- You haven't run the schema or migration yet
- Use Option A or C

**Error: "duplicate key value"**
- You've already run the seed data
- This is fine - the script uses `ON CONFLICT DO NOTHING` to prevent duplicates
