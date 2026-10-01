/**
 * Competitor registration summary for the signed-in account.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getManagedCompetitors } from '@/lib/identity/competitors'

export default async function MemberRegistrationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const managed = await getManagedCompetitors(admin, user.id)
  const competitorIds = managed.map((c) => c.id)

  const { data: registrations } = competitorIds.length
    ? await admin
        .from('registrations')
        .select(
          `
          id, status, eligibility_status, payment_status, waiver_status, created_at,
          event:events(id, name, event_date, starts_at, status, timezone),
          competitor:competitors(id, full_name, public_id),
          entries:registration_entries(
            id, status, waitlist_position,
            division:divisions(id, name)
          )
        `
        )
        .in('competitor_id', competitorIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My registrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Event registrations for competitors you manage.
        </p>
      </div>

      {!registrations?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No registrations yet.{' '}
            <Link href="/events" className="text-primary underline">
              Browse events
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => {
            const event = reg.event as unknown as {
              id: string
              name: string
              status: string
              event_date: string | null
            } | null
            const competitor = reg.competitor as unknown as {
              full_name: string
              public_id: string | null
            } | null
            const entries =
              (reg.entries as unknown as Array<{
                id: string
                status: string
                waitlist_position: number | null
                division: { id: string; name: string } | null
              }>) ?? []

            return (
              <Card key={reg.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{event?.name ?? 'Event'}</CardTitle>
                      <CardDescription>
                        {competitor?.full_name}
                        {competitor?.public_id ? ` · ${competitor.public_id}` : ''}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{reg.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-sm space-y-1">
                    {entries.map((e) => (
                      <li key={e.id} className="flex gap-2 flex-wrap">
                        <span>{e.division?.name}</span>
                        <Badge variant="outline">{e.status}</Badge>
                        {e.waitlist_position != null && (
                          <span className="text-muted-foreground">
                            Waitlist #{e.waitlist_position}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-muted-foreground">
                    Eligibility: {reg.eligibility_status} · Payment: {reg.payment_status} ·
                    Waiver: {reg.waiver_status}
                  </div>
                  {event?.id && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/events/${event.id}`}>Open event hub</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
