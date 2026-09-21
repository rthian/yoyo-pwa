/**
 * Password Reset API Route
 * Sends password reset email — or in DEV bypass mode, sets password via admin (no email)
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

function isDevBypassEnabled() {
  return (
    process.env.DEV_PASSWORD_RESET_BYPASS === 'true' &&
    process.env.NODE_ENV !== 'production'
  )
}

export async function GET() {
  return NextResponse.json({
    bypassEnabled: isDevBypassEnabled(),
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, newPassword, bypass } = body as {
      email?: string
      newPassword?: string
      bypass?: boolean
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Temporary local bypass: set password with service role (skips email rate limit)
    if (bypass && isDevBypassEnabled()) {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 }
        )
      }

      const admin = createAdminClient()
      const { data: listed, error: listError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })

      if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 400 })
      }

      const user = listed.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      )

      if (!user) {
        return NextResponse.json(
          { error: 'No account found for that email' },
          { status: 404 }
        )
      }

      const { error: updateError } = await admin.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      )

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }

      return NextResponse.json({
        message: 'Password updated (dev bypass — no email sent)',
        bypass: true,
      })
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return NextResponse.json(
        {
          error:
            'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.',
        },
        { status: 503 }
      )
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${request.headers.get('origin')}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`,
    })

    if (error) {
      const rateLimited = /rate limit|over_email_send_rate_limit/i.test(
        error.message
      )
      return NextResponse.json(
        {
          error: error.message,
          rateLimited,
          bypassAvailable: isDevBypassEnabled(),
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'Password reset email sent',
    })
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
