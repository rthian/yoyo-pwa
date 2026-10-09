/**
 * Prompt 16: dashboard entry to /organize when user has staff events.
 * Callers: MemberDashboardView, JudgeDashboardView, AdminDashboardView
 * Glob: no prior components/organize/*
 * API: GET /api/organize/events → { events: [{ id, name, roles }] }
 * User: "ok continue next"
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClipboardList, ArrowRight, Loader2 } from 'lucide-react'

export default function OrganizeEntryCard() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/organize/events')
      .then(async (res) => {
        if (!res.ok) return { events: [] }
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setCount((data.events || []).length)
      })
      .catch(() => {
        if (!cancelled) setCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (count === null) {
    return (
      <Card className="border-dashed mb-6">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking event staff access…
        </CardContent>
      </Card>
    )
  }

  if (count === 0) return null

  return (
    <Card className="border-primary/20 bg-primary/5 mb-6">
      <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <ClipboardList className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Event ops</h2>
            <p className="text-sm text-muted-foreground">
              You have staff access to {count} event{count === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Link href="/organize">
          <Button>
            Open event ops
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
