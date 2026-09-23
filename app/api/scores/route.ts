/**
 * Scores API Route
 * Handles score creation, updates, and retrieval
 * Uses admin client to bypass RLS for all DB queries
 * Callers: ScoringForm, offline sync. Math: lib/judge/score-math.ts
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { scoreSchema } from '@/lib/validations'
import {
  computeScores,
  majorDeductionPoints,
  type ScoringConfigLike,
} from '@/lib/judge/score-math'

// Create or update a score
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get member to verify they're a judge (admin client bypasses RLS)
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!member || (member.role !== 'judge' && member.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only judges can submit scores' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate the score data (judge_id comes from auth, not the payload)
    const apiScoreSchema = scoreSchema.omit({ judge_id: true })
    const validationResult = apiScoreSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const scoreData = validationResult.data

    // Verify judge is assigned to this division
    const { data: assignment } = await supabaseAdmin
      .from('division_judges')
      .select('id')
      .eq('division_id', scoreData.division_id)
      .eq('member_id', user.id)
      .single()

    if (!assignment) {
      return NextResponse.json(
        { error: 'Not assigned to this division' },
        { status: 403 }
      )
    }

    // Check if division is locked + load round/ruleset for score math
    const { data: division } = await supabaseAdmin
      .from('divisions')
      .select(`
        scoring_locked,
        round_type,
        event:events(
          ruleset:rulesets(scoring_config)
        )
      `)
      .eq('id', scoreData.division_id)
      .single()

    if (division?.scoring_locked) {
      return NextResponse.json(
        { error: 'Division is locked. No scores can be submitted or updated.' },
        { status: 403 }
      )
    }

    type EventJoin = {
      ruleset: { scoring_config: ScoringConfigLike } | { scoring_config: ScoringConfigLike }[] | null
    } | null
    const eventRaw = division?.event as EventJoin | EventJoin[] | undefined
    const event = Array.isArray(eventRaw) ? eventRaw[0] : eventRaw
    const rulesetRaw = event?.ruleset
    const ruleset = Array.isArray(rulesetRaw) ? rulesetRaw[0] : rulesetRaw
    const scoringConfig = (ruleset?.scoring_config ?? null) as ScoringConfigLike | null

    const mdStop = scoreData.md_stop_count ?? 0
    const mdDiscard = scoreData.md_discard_count ?? 0
    const mdDetach = scoreData.md_detach_count ?? 0
    const fields = {
      ...scoreData,
      md_stop_count: mdStop,
      md_discard_count: mdDiscard,
      md_detach_count: mdDetach,
      ex_deductions: majorDeductionPoints({
        ...scoreData,
        md_stop_count: mdStop,
        md_discard_count: mdDiscard,
        md_detach_count: mdDetach,
      }),
    }
    const computed = computeScores(
      fields,
      scoringConfig,
      division?.round_type ?? 'final'
    )
    const technical = computed.technical
    const performance = computed.performance
    const total = computed.total

    // Check if score already exists
    const { data: existingScore } = await supabaseAdmin
      .from('scores')
      .select('id, is_submitted')
      .eq('division_member_id', scoreData.division_member_id)
      .eq('judge_id', user.id)
      .single()

    const isSubmit = body.is_submitted === true

    // Prevent updating already-submitted scores
    if (existingScore?.is_submitted && !isSubmit) {
      return NextResponse.json(
        { error: 'Cannot modify an already submitted score' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const finalScoreData = {
      ...scoreData,
      md_stop_count: fields.md_stop_count,
      md_discard_count: fields.md_discard_count,
      md_detach_count: fields.md_detach_count,
      ex_deductions: fields.ex_deductions,
      judge_id: user.id,
      technical_score: technical,
      performance_score: performance,
      total_score: total,
      is_submitted: isSubmit,
      submitted_at: isSubmit ? now : null,
      ...(existingScore && { updated_at: now }),
    }

    let result
    if (existingScore) {
      // Update existing score
      const { data, error } = await supabaseAdmin
        .from('scores')
        .update(finalScoreData)
        .eq('id', existingScore.id)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // Create new score
      const { data, error } = await supabaseAdmin
        .from('scores')
        .insert(finalScoreData)
        .select()
        .single()

      if (error) throw error
      result = data
    }

    return NextResponse.json({ score: result }, { status: existingScore ? 200 : 201 })
  } catch (error) {
    console.error('Score API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get scores for a division or member
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const divisionId = searchParams.get('division_id')
    const divisionMemberId = searchParams.get('division_member_id')

    let query = supabaseAdmin
      .from('scores')
      .select(`
        *,
        division_member:division_members(
          id,
          member:members(full_name, nickname)
        )
      `)

    if (divisionId) {
      query = query.eq('division_id', divisionId)
    }

    if (divisionMemberId) {
      query = query.eq('division_member_id', divisionMemberId)
    }

    // Non-admins can only see their own scores
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    if (member?.role !== 'admin') {
      query = query.eq('judge_id', user.id)
    }

    const { data: scores, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ scores })
  } catch (error) {
    console.error('Score API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
