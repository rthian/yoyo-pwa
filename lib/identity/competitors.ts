/**
 * Identity helpers: accounts (members) manage competitors via links.
 * Slice A: competitors + links. Slice B: dual-write competitor_id helpers.
 * Callers: signup, participants API, rankings standings/finalize.
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

/** Resolve self-linked competitor UUID for an auth account id. */
export async function getCompetitorIdForMember(
  supabase: SupabaseClient,
  memberId: string
): Promise<string | null> {
  const { data: link } = await supabase
    .from('account_competitor_links')
    .select('competitor_id')
    .eq('account_id', memberId)
    .eq('relationship', 'self')
    .maybeSingle()

  return link?.competitor_id ?? null
}

/** Self-linked auth account id for a competitor (if any). */
export async function getSelfAccountIdForCompetitor(
  supabase: SupabaseClient,
  competitorId: string
): Promise<string | null> {
  const map = await mapSelfAccountIdsForCompetitors(supabase, [competitorId])
  return map.get(competitorId) ?? null
}

/** Batch map competitor id → self account id. */
export async function mapSelfAccountIdsForCompetitors(
  supabase: SupabaseClient,
  competitorIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(competitorIds.filter(Boolean))]
  const out = new Map<string, string>()
  if (!unique.length) return out

  const { data: links, error } = await supabase
    .from('account_competitor_links')
    .select('account_id, competitor_id')
    .in('competitor_id', unique)
    .eq('relationship', 'self')

  if (error) throw new Error(error.message)
  for (const row of links ?? []) {
    out.set(row.competitor_id, row.account_id)
  }
  return out
}

/** All competitor ids an account manages (any relationship). */
export async function getCompetitorIdsForAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('account_competitor_links')
    .select('competitor_id')
    .eq('account_id', accountId)

  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).map((r) => r.competitor_id).filter(Boolean))]
}

/**
 * Slice B: map member ids → competitor ids (missing links omitted).
 */
export async function mapCompetitorIdsForMembers(
  supabase: SupabaseClient,
  memberIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(memberIds.filter(Boolean))]
  const out = new Map<string, string>()
  if (!unique.length) return out

  const { data: links, error } = await supabase
    .from('account_competitor_links')
    .select('account_id, competitor_id')
    .in('account_id', unique)
    .eq('relationship', 'self')

  if (error) throw new Error(error.message)
  for (const row of links ?? []) {
    out.set(row.account_id, row.competitor_id)
  }

  return out
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

export type CreateManagedCompetitorInput = {
  accountId: string
  full_name: string
  nickname?: string | null
  country?: string | null
  gender?: string | null
  relationship?: Exclude<CompetitorRelationship, 'self'>
  can_register?: boolean
  can_manage_music?: boolean
  can_manage_profile?: boolean
}

/**
 * Prompt 17: create a dependent competitor + guardian/manager/coach link.
 * Does not create a self link on the competitor (no Auth account for the child).
 */
export async function createManagedCompetitor(
  supabase: SupabaseClient,
  input: CreateManagedCompetitorInput
): Promise<{ competitor: Competitor; link: AccountCompetitorLink }> {
  const relationship = input.relationship ?? 'guardian'
  const publicId = generateLeagueId()

  const { data: competitor, error: competitorError } = await supabase
    .from('competitors')
    .insert({
      public_id: publicId,
      full_name: input.full_name.trim(),
      nickname: input.nickname ?? null,
      country: input.country ?? null,
      gender: input.gender ?? 'undisclosed',
      profile_visibility: 'public',
      is_active: true,
    })
    .select()
    .single()

  if (competitorError || !competitor) {
    throw new Error(competitorError?.message || 'Failed to create competitor')
  }

  const { data: link, error: linkError } = await supabase
    .from('account_competitor_links')
    .insert({
      account_id: input.accountId,
      competitor_id: competitor.id,
      relationship,
      can_register: input.can_register ?? true,
      can_manage_music: input.can_manage_music ?? false,
      can_manage_profile: input.can_manage_profile ?? true,
      granted_by: input.accountId,
    })
    .select()
    .single()

  if (linkError || !link) {
    await supabase.from('competitors').delete().eq('id', competitor.id)
    throw new Error(linkError?.message || 'Failed to create management link')
  }

  return {
    competitor: competitor as Competitor,
    link: link as AccountCompetitorLink,
  }
}

export type UpdateLinkCapabilitiesInput = {
  can_register?: boolean
  can_manage_music?: boolean
  can_manage_profile?: boolean
  relationship?: Exclude<CompetitorRelationship, 'self'>
}

/** Update caps / non-self relationship on a link the account owns. */
export async function updateLinkCapabilities(
  supabase: SupabaseClient,
  accountId: string,
  linkId: string,
  patch: UpdateLinkCapabilitiesInput
): Promise<AccountCompetitorLink> {
  const { data: existing, error: fetchError } = await supabase
    .from('account_competitor_links')
    .select('*')
    .eq('id', linkId)
    .eq('account_id', accountId)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!existing) {
    const err = new Error('Link not found')
    ;(err as Error & { status: number }).status = 404
    throw err
  }

  if (existing.relationship === 'self') {
    if (patch.relationship) {
      const err = new Error('Cannot change relationship on a self link')
      ;(err as Error & { status: number }).status = 400
      throw err
    }
    if (
      typeof patch.can_register === 'boolean' ||
      typeof patch.can_manage_music === 'boolean' ||
      typeof patch.can_manage_profile === 'boolean'
    ) {
      const err = new Error('Cannot change capabilities on your self link')
      ;(err as Error & { status: number }).status = 400
      throw err
    }
  }

  const update: Record<string, unknown> = {}
  if (typeof patch.can_register === 'boolean') update.can_register = patch.can_register
  if (typeof patch.can_manage_music === 'boolean') {
    update.can_manage_music = patch.can_manage_music
  }
  if (typeof patch.can_manage_profile === 'boolean') {
    update.can_manage_profile = patch.can_manage_profile
  }
  if (patch.relationship && existing.relationship !== 'self') {
    update.relationship = patch.relationship
  }

  if (!Object.keys(update).length) {
    return existing as AccountCompetitorLink
  }

  const { data, error } = await supabase
    .from('account_competitor_links')
    .update(update)
    .eq('id', linkId)
    .eq('account_id', accountId)
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update link')
  }
  return data as AccountCompetitorLink
}

/**
 * Revoke a non-self management link. Self links cannot be revoked this way.
 * Leaves the competitor row intact (may still appear in rankings/history).
 */
export async function revokeManagedLink(
  supabase: SupabaseClient,
  accountId: string,
  linkId: string
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('account_competitor_links')
    .select('*')
    .eq('id', linkId)
    .eq('account_id', accountId)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!existing) {
    const err = new Error('Link not found')
    ;(err as Error & { status: number }).status = 404
    throw err
  }
  if (existing.relationship === 'self') {
    const err = new Error('Cannot revoke your own competitor identity link')
    ;(err as Error & { status: number }).status = 400
    throw err
  }

  const { error } = await supabase
    .from('account_competitor_links')
    .delete()
    .eq('id', linkId)
    .eq('account_id', accountId)

  if (error) throw new Error(error.message)
}

