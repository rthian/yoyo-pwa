/**
 * Slice E: account row (members) + self competitor profile composition.
 *
 * GateGuard facts:
 * 1. Callers: app/api/member/me/route.ts, app/api/member/profile/route.ts,
 *    lib/auth/actions.ts, app/(admin)/admin/members/page.tsx,
 *    app/(admin)/admin/members/[id]/edit/page.tsx, app/api/members/[id]/route.ts
 * 2. Glob: no prior lib/identity/account-profile.ts (complements competitors.ts)
 * 3. Sample composed Member: { id: "acct_demo", email: "a@b.c", full_name: "Ada",
 *    public_id: "ZX905JYC", nickname: null } — profile fields from competitors
 * 4. User: "next"
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Competitor, Member, MemberRole, ProfileVisibility } from '@/lib/types/database'
import { getCompetitorIdForMember } from '@/lib/identity/competitors'

/** Columns that remain on members after Slice E migration 024. */
export const ACCOUNT_MEMBER_COLUMNS =
  'id, email, full_name, role, is_active, created_at, updated_at' as const

export type AccountMemberRow = {
  id: string
  email: string
  full_name: string
  role: MemberRole
  is_active: boolean
  created_at: string
  updated_at: string
}

const COMPETITOR_PROFILE_COLUMNS =
  'id, public_id, full_name, nickname, country, home_geo_id, gender, avatar_url, bio, profile_visibility, first_competed_on, is_active'

/** Overlay self-competitor profile fields onto an account row for API/UI compat. */
export function composeMember(
  account: AccountMemberRow,
  competitor?: Pick<
    Competitor,
    | 'public_id'
    | 'nickname'
    | 'country'
    | 'home_geo_id'
    | 'gender'
    | 'avatar_url'
    | 'bio'
    | 'profile_visibility'
    | 'first_competed_on'
  > | null
): Member {
  return {
    id: account.id,
    email: account.email,
    full_name: account.full_name,
    role: account.role,
    is_active: account.is_active,
    created_at: account.created_at,
    updated_at: account.updated_at,
    nickname: competitor?.nickname ?? null,
    country: competitor?.country ?? null,
    home_geo_id: competitor?.home_geo_id ?? null,
    gender: (competitor?.gender as Member['gender']) ?? null,
    public_id: competitor?.public_id ?? null,
    avatar_url: competitor?.avatar_url ?? null,
    bio: competitor?.bio ?? null,
    profile_visibility:
      (competitor?.profile_visibility as ProfileVisibility | null) ?? null,
    first_competed_on: competitor?.first_competed_on ?? null,
  }
}

export async function getSelfCompetitorForAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<Competitor | null> {
  const competitorId = await getCompetitorIdForMember(supabase, accountId)
  if (!competitorId) return null
  const { data } = await supabase
    .from('competitors')
    .select(COMPETITOR_PROFILE_COLUMNS)
    .eq('id', competitorId)
    .maybeSingle()
  return (data as Competitor | null) ?? null
}

export async function getComposedMember(
  supabase: SupabaseClient,
  accountId: string
): Promise<Member | null> {
  const { data: account, error } = await supabase
    .from('members')
    .select(ACCOUNT_MEMBER_COLUMNS)
    .eq('id', accountId)
    .maybeSingle()

  if (error || !account) return null

  const competitor = await getSelfCompetitorForAccount(supabase, accountId)
  return composeMember(account as AccountMemberRow, competitor)
}

/** Batch-compose for admin lists via self account_competitor_links. */
export async function composeMembersForAccounts(
  supabase: SupabaseClient,
  accounts: AccountMemberRow[]
): Promise<Member[]> {
  if (!accounts.length) return []

  const ids = accounts.map((a) => a.id)
  const byAccount = new Map<string, Competitor>()

  const { data: links } = await supabase
    .from('account_competitor_links')
    .select('account_id, competitor_id')
    .in('account_id', ids)
    .eq('relationship', 'self')

  const competitorIds = [
    ...new Set((links ?? []).map((l) => l.competitor_id).filter(Boolean)),
  ]
  if (competitorIds.length) {
    const { data: comps } = await supabase
      .from('competitors')
      .select(COMPETITOR_PROFILE_COLUMNS)
      .in('id', competitorIds)
    const byId = new Map((comps ?? []).map((c) => [c.id, c as Competitor]))
    for (const link of links ?? []) {
      const c = byId.get(link.competitor_id)
      if (c) byAccount.set(link.account_id, c)
    }
  }

  return accounts.map((a) => composeMember(a, byAccount.get(a.id) ?? null))
}

export type SelfProfilePatch = {
  full_name: string
  nickname?: string | null
  country?: string | null
  gender?: string | null
  home_geo_id?: string | null
}

/** Update account display name + self competitor competition profile. */
export async function updateAccountAndSelfProfile(
  supabase: SupabaseClient,
  accountId: string,
  patch: SelfProfilePatch
): Promise<Member> {
  const { data: account, error: accountError } = await supabase
    .from('members')
    .update({ full_name: patch.full_name })
    .eq('id', accountId)
    .select(ACCOUNT_MEMBER_COLUMNS)
    .single()

  if (accountError || !account) {
    throw new Error(accountError?.message || 'Failed to update account')
  }

  const competitorId = await getCompetitorIdForMember(supabase, accountId)
  let competitor: Competitor | null = null

  if (competitorId) {
    const { data, error } = await supabase
      .from('competitors')
      .update({
        full_name: patch.full_name,
        nickname: patch.nickname ?? null,
        country: patch.country ?? null,
        gender: patch.gender ?? 'undisclosed',
        home_geo_id: patch.home_geo_id ?? null,
      })
      .eq('id', competitorId)
      .select(COMPETITOR_PROFILE_COLUMNS)
      .single()
    if (error) throw new Error(error.message)
    competitor = data as Competitor
  }

  return composeMember(account as AccountMemberRow, competitor)
}
