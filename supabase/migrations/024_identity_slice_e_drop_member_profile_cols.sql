-- Prompt 2 Slice E: drop competition profile columns from members.
-- GateGuard facts:
-- 1. Callers: Supabase SQL apply after app cutover (account-profile + me/profile/signup)
-- 2. Glob: no prior 024_identity*; follows 023
-- 3. Sample members after: { id: "acct_demo", email: "a@b.c", full_name: "Ada", role: "member", is_active: true }
-- 4. User: "next"
-- Rollback: re-add nullable columns + backfill from competitors via source_member_id / self link.

DROP VIEW IF EXISTS public_members;

DROP INDEX IF EXISTS idx_members_public_id;
DROP INDEX IF EXISTS idx_members_home_geo;
DROP INDEX IF EXISTS idx_members_full_name_trgm;
DROP INDEX IF EXISTS idx_members_nickname_trgm;

ALTER TABLE members DROP COLUMN IF EXISTS public_id;
ALTER TABLE members DROP COLUMN IF EXISTS nickname;
ALTER TABLE members DROP COLUMN IF EXISTS country;
ALTER TABLE members DROP COLUMN IF EXISTS home_geo_id;
ALTER TABLE members DROP COLUMN IF EXISTS gender;
ALTER TABLE members DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE members DROP COLUMN IF EXISTS bio;
ALTER TABLE members DROP COLUMN IF EXISTS profile_visibility;
ALTER TABLE members DROP COLUMN IF EXISTS first_competed_on;

COMMENT ON TABLE members IS
  'Slice E: Auth accounts only (email, role, display full_name). Competition profile on competitors.';

COMMENT ON VIEW public_competitors IS
  'Public competition profiles; public_members dropped in Slice E';
