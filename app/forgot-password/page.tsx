/**
 * Forgot Password Page
 * Requests a password reset email, or uses local DEV bypass when rate-limited
 */
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [bypassAvailable, setBypassAvailable] = useState(false)
  const [useBypass, setUseBypass] = useState(false)

  useEffect(() => {
    fetch('/api/auth/reset-password')
      .then((r) => r.json())
      .then((data) => {
        if (data.bypassEnabled) {
          setBypassAvailable(true)
          setUseBypass(true)
        }
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (useBypass && bypassAvailable) {
        if (newPassword !== confirmPassword) {
          setError('Passwords do not match')
          return
        }
        if (newPassword.length < 6) {
          setError('Password must be at least 6 characters')
          return
        }

        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, newPassword, bypass: true }),
        })
        const data = await response.json()
        if (!response.ok) {
          setError(data.error || 'Failed to reset password')
          return
        }
        setSuccessMessage(data.message || 'Password updated')
        setSuccess(true)
        setTimeout(() => router.push('/login'), 1500)
        return
      }

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.rateLimited && data.bypassAvailable) {
          setBypassAvailable(true)
          setUseBypass(true)
          setError(
            'Email rate limit exceeded. Use the temporary local reset form below (no email).'
          )
          return
        }
        setError(data.error || 'Failed to send reset email')
        return
      }

      setSuccessMessage(`We've sent a password reset link to ${email}`)
      setSuccess(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">
              {useBypass ? 'Password Updated' : 'Check Your Email'}
            </CardTitle>
            <CardDescription>{successMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🪀</div>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            {useBypass && bypassAvailable
              ? 'Temporary local reset (skips email rate limit) — set a new password directly'
              : "Enter your email and we'll send you a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="judge@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {useBypass && bypassAvailable && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg">
                  Dev only. Remove <code>DEV_PASSWORD_RESET_BYPASS</code> from{' '}
                  <code>.env.local</code> when done testing.
                </p>
              </>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {useBypass ? 'Updating...' : 'Sending...'}
                </>
              ) : useBypass && bypassAvailable ? (
                'Set New Password'
              ) : (
                'Send Reset Link'
              )}
            </Button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3 inline mr-1" />
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
