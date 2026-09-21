/**
 * Offline Score Sync API
 * Handles syncing scores that were saved while offline
 * Uses admin client to bypass RLS for all DB queries
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

interface OfflineScore {
  clientId: string
  divisionId: string
  divisionMemberId: string
  scoreData: Record<string, number>
  timestamp: number
}

export async function POST(request: Request) {
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

    const { scores } = await request.json() as { scores: OfflineScore[] }
    
    if (!Array.isArray(scores) || scores.length === 0) {
      return NextResponse.json(
        { error: 'No scores to sync' },
        { status: 400 }
      )
    }

    const results: { success: string[]; failed: string[] } = {
      success: [],
      failed: [],
    }

    for (const offlineScore of scores) {
      try {
        const { data: assignment } = await supabaseAdmin
          .from('division_judges')
          .select('id')
          .eq('division_id', offlineScore.divisionId)
          .eq('member_id', user.id)
          .maybeSingle()
        if (!assignment) {
          results.failed.push(offlineScore.clientId)
          continue
        }

        const { data: division } = await supabaseAdmin
          .from('divisions')
          .select('scoring_locked')
          .eq('id', offlineScore.divisionId)
          .maybeSingle()
        if (!division || division.scoring_locked) {
          results.failed.push(offlineScore.clientId)
          continue
        }

        const { data: participant } = await supabaseAdmin
          .from('division_members')
          .select('id')
          .eq('id', offlineScore.divisionMemberId)
          .eq('division_id', offlineScore.divisionId)
          .maybeSingle()
        if (!participant) {
          results.failed.push(offlineScore.clientId)
          continue
        }

        // Calculate totals
        const { scoreData } = offlineScore
        const technical = (scoreData.ex_clicks || 0) * 0.1 + 
          (scoreData.ex_pv || 0) + 
          (scoreData.ex_ch || 0) + 
          (scoreData.ex_cons || 0)
        
        const performance = (scoreData.ex_space || 0) + 
          (scoreData.ex_body || 0) + 
          (scoreData.ex_showman || 0) + 
          (scoreData.ex_music || 0) + 
          (scoreData.ex_construct || 0) + 
          (scoreData.ex_trick_div || 0)

        const total = Math.max(0, technical + performance - (scoreData.ex_deductions || 0))

        // Check for existing score
        const { data: existing } = await supabaseAdmin
          .from('scores')
          .select('id, updated_at')
          .eq('division_member_id', offlineScore.divisionMemberId)
          .eq('judge_id', user.id)
          .single()

        const finalData = {
          division_id: offlineScore.divisionId,
          division_member_id: offlineScore.divisionMemberId,
          judge_id: user.id,
          ...scoreData,
          technical_score: technical,
          performance_score: performance,
          total_score: total,
          is_submitted: true,
          submitted_at: new Date(offlineScore.timestamp).toISOString(),
        }

        if (existing) {
          // Only update if offline version is newer
          const existingTime = new Date(existing.updated_at).getTime()
          if (offlineScore.timestamp > existingTime) {
            await supabaseAdmin
              .from('scores')
              .update(finalData)
              .eq('id', existing.id)
          }
        } else {
          await supabaseAdmin
            .from('scores')
            .insert(finalData)
        }

        results.success.push(offlineScore.clientId)
      } catch (err) {
        console.error('Failed to sync score:', offlineScore.clientId, err)
        results.failed.push(offlineScore.clientId)
      }
    }

    return NextResponse.json({
      message: 'Sync complete',
      synced: results.success.length,
      failed: results.failed.length,
      results,
    })
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
