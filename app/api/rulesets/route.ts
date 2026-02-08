/**
 * Rulesets API Route
 * Handles ruleset listing and creation
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { rulesetSchema } from '@/lib/validations'

// List all active rulesets
export async function GET() {
  try {
    const supabaseAdmin = createAdminClient()

    const { data: rulesets, error } = await supabaseAdmin
      .from('rulesets')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ rulesets })
  } catch (error) {
    console.error('Rulesets fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Create new ruleset (admin only)
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

    const { data: currentMember } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentMember?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can create rulesets' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = rulesetSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { data: ruleset, error } = await supabaseAdmin
      .from('rulesets')
      .insert({
        ...validationResult.data,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ruleset }, { status: 201 })
  } catch (error) {
    console.error('Ruleset creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
