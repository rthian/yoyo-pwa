/**
 * Slice A identity helpers: accounts (members) manage competitors via links.
 * Callers: app/api/auth/register, app/api/auth/signup, future registration APIs.
 * No FK remaps yet — competition tables still reference members.
 * User: ADR Account vs Competitor Identity / Prompt 2 Slice A
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateLeagueId } from '@/lib/rankings/league-id'
import type {
  AccountCompetitorLink,
  Competitor,
  CompetitorCapability,
  CompetitorRelationship,
} from '@/lib/types/database'

export type ManagedCompetitor = Competitor & {
  link: AccountCompetitorLink
}

type MemberProfileRow = {
  id: string
  full_name: string
  nickname?: string | null
  country?: string | null
  home_geo_id?: string | null
  gender?: string | null
  avatar_url?: string | null
  bio?: string | null
  profile_visibility?: string | null
  first_competed_on?: string | null
  public_id?: string | null
  is_active?: boolean | null
}

const CAPABILITY_COLUMN: Record<Exclude<CompetitorCapability, 'any'>, keyof AccountCompetitorLink> = {
  register: 'can_register',
  music: 'can_manage_music',
  profile: 'can_manage_profile',
}

function linkAllows(link: AccountCompetitorLink, capability: CompetitorCapability): boolean {
  if (capability === 'any') return true
  return Boolean(link[CAPABILITY_COLUMN[capability]])
}

/**
 * Create a competitor + self link for a newly created account member.
 * Idempotent if a self-link already exists for this account.
 */
export async function ensureSelfCompetitorForMember(
  supabase: SupabaseClient,
  member: MemberProfileRow,
  options?: { publicId?: string | null; grantedBy?: string | null }
): Promise<{ competitor: Competitor; link: AccountCompetitorLink; created: boolean }> {
  const { data: existingLink } = await supabase
    .from('account_competitor_links')
    .select('*')
    .eq('account_id', member.id)
    .eq('relationship', 'self')
    .maybeSingle()

  if (existingLink) {
    const { data: existingCompetitor } = await supabase
      .from('competitors')
      .select('*')
      .eq('id', existingLink.competitor_id)
      .single()
    if (existingCompetitor) {
      return {
        competitor: existingCompetitor as Competitor,
        link: existingLink as AccountCompetitorLink,
        created: false,
      }
    }
  }

  const publicId = options?.publicId ?? member.public_id ?? generateLeagueId()

  const { data: competitor, error: competitorError } = await supabase
    .from('competitors')
    .insert({
      source_member_id: member.id,
      public_id: publicId,
      full_name: member.full_name,
      nickname: member.nickname ?? null,
      country: member.country ?? null,
      home_geo_id: member.home_geo_id ?? null,
      gender: member.gender ?? 'undisclosed',
      avatar_url: member.avatar_url ?? null,
      bio: member.bio ?? null,
      profile_visibility: member.profile_visibility ?? 'public',
      first_competed_on: member.first_competed_on ?? null,
      is_active: member.is_active ?? true,
    })
    .select()
    .single()

  if (competitorError || !competitor) {
    throw new Error(competitorError?.message || 'Failed to create competitor')
  }

  const { data: link, error: linkError } = await supabase
    .from('account_competitor_links')
    .insert({
      account_id: member.id,
      competitor_id: competitor.id,
      relationship: 'self' satisfies CompetitorRelationship,
      can_register: true,
      can_manage_music: true,
      can_manage_profile: true,
      granted_by: options?.grantedBy ?? member.id,
    })
    .select()
    .single()

  if (linkError || !link) {
    // Best-effort cleanup of orphan competitor row
    await supabase.from('competitors').delete().eq('id', competitor.id)
    throw new Error(linkError?.message || 'Failed to create self link')
  }

  return {
    competitor: competitor as Competitor,
    link: link as AccountCompetitorLink,
    created: true,
  }
}

/** Competitors the account may act for (any relationship). */
export async function getManagedCompetitors(
  supabase: SupabaseClient,
  accountId: string
): Promise<ManagedCompetitor[]> {
  const { data, error } = await supabase
    .from('account_competitor_links')
    .select('*, competitor:competitors(*)')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const out: ManagedCompetitor[] = []
  for (const row of rows) {
    const raw = (row as { competitor?: Competitor | Competitor[] | null }).competitor
    const competitor = Array.isArray(raw) ? raw[0] : raw
    if (!competitor) continue
    const link: AccountCompetitorLink = {
      id: row.id,
      account_id: row.account_id,
      competitor_id: row.competitor_id,
      relationship: row.relationship,
      can_register: row.can_register,
      can_manage_music: row.can_manage_music,
      can_manage_profile: row.can_manage_profile,
      granted_by: row.granted_by,
      created_at: row.created_at,
    }
    out.push({ ...competitor, link })
  }
  return out
}

/**
 * Resolve competitor UUID for a legacy member id (Slice A bridge).
 */
export async function getCompetitorIdForMember(
  supabase: SupabaseClient,
  memberId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('competitors')
    .select('id')
    .eq('source_member_id', memberId)
    .maybeSingle()
  if (data?.id) return data.id

  const { data: link } = await supabase
    .from('account_competitor_links')
    .select('competitor_id')
    .eq('account_id', memberId)
    .eq('relationship', 'self')
    .maybeSingle()

  return link?.competitor_id ?? null
}

export async function assertManagesCompetitor(
  supabase: SupabaseClient,
  accountId: string,
  competitorId: string,
  capability: CompetitorCapability = 'any',
  options?: { isAdmin?: boolean }
): Promise<AccountCompetitorLink> {
  if (options?.isAdmin) {
    const { data: stub } = await supabase
      .from('account_competitor_links')
      .select('*')
      .eq('competitor_id', competitorId)
      .eq('relationship', 'self')
      .maybeSingle()
    if (stub) return stub as AccountCompetitorLink
    // Admin may act without a link — synthesize a read-only stub for callers
    return {
      id: 'admin',
      account_id: accountId,
      competitor_id: competitorId,
      relationship: 'manager',
      can_register: true,
      can_manage_music: true,
      can_manage_profile: true,
      granted_by: accountId,
      created_at: new Date().toISOString(),
    }
  }

  const { data: link, error } = await supabase
    .from('account_competitor_links')
    .select('*')
    .eq('account_id', accountId)
    .eq('competitor_id', competitorId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!link || !linkAllows(link as AccountCompetitorLink, capability)) {
    const err = new Error('Forbidden: account does not manage this competitor')
    ;(err as Error & { status: number }).status = 403
    throw err
  }

  return link as AccountCompetitorLink
}
