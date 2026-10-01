/**
 * Organizer registration list + CSV export for an event.
 */
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface EventRegistrationsPanelProps {
  eventId: string
}

type RegRow = {
  id: string
  status: string
  eligibility_status: string
  payment_status: string
  waiver_status: string
  competitor: {
    full_name: string
    nickname: string | null
    public_id: string | null
    country: string | null
  } | null
  entries: Array<{
    id: string
    status: string
    waitlist_position: number | null
    division: { id: string; name: string } | null
  }>
}

export default function EventRegistrationsPanel({ eventId }: EventRegistrationsPanelProps) {
  const [rows, setRows] = useState<RegRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setRows(data.registrations || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load registrations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const cancel = async (registrationId: string) => {
    if (!confirm('Cancel this registration and remove synced division seats?')) return
    setActing(registrationId)
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: registrationId, action: 'cancel' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Cancel failed')
      toast.success('Registration cancelled')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setActing(null)
    }
  }

  const promote = async (registrationId: string, entryId: string) => {
    setActing(entryId)
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: registrationId,
          entry_id: entryId,
          action: 'confirm_entry',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Confirm failed')
      toast.success(
        data.entry?.status === 'waitlisted' ? 'Still waitlisted (full)' : 'Confirmed'
      )
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Confirm failed')
    } finally {
      setActing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading registrations…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/events/${eventId}/registrations?format=csv`}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </a>
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No registrations yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Competitor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Divisions</TableHead>
              <TableHead className="w-[160px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.competitor?.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[row.competitor?.public_id, row.competitor?.country]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.status}</Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    eligibility: {row.eligibility_status}
                  </div>
                </TableCell>
                <TableCell>
                  <ul className="text-sm space-y-1">
                    {(row.entries ?? []).map((e) => (
                      <li key={e.id} className="flex items-center gap-2 flex-wrap">
                        <span>{e.division?.name ?? 'Division'}</span>
                        <Badge variant="outline">{e.status}</Badge>
                        {e.waitlist_position != null && (
                          <span className="text-xs text-muted-foreground">
                            WL #{e.waitlist_position}
                          </span>
                        )}
                        {e.status === 'waitlisted' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={acting === e.id}
                            onClick={() => promote(row.id, e.id)}
                          >
                            Promote
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell>
                  {row.status !== 'cancelled' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={acting === row.id}
                      onClick={() => cancel(row.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
