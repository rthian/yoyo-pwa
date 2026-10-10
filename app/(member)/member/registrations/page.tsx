/**
 * Competitor registration summary — Prompt 20 payment panel.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getManagedCompetitors } from '@/lib/identity/competitors'
import PaymentReceiptPanel from '@/components/member/PaymentReceiptPanel'
import EventPrepChecklist from '@/components/member/EventPrepChecklist'
import { buildPrepChecklistForRegistration } from '@/lib/prep/checklist'

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
          event:events(
            id, name, event_date, starts_at, status, timezone,
            payment_required, registration_fee_cents, registration_fee_currency,
            payment_instructions, payment_qr_url, payment_qr_payload, venue_name
          ),
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

  const rows = await Promise.all(
    (registrations ?? []).map(async (reg) => {
      const event = reg.event as unknown as {
        id: string
        name: string
        venue_name?: string | null
        payment_required?: boolean
      } | null
      const items = await buildPrepChecklistForRegistration(admin, {
        registrationId: reg.id,
        paymentStatus: reg.payment_status,
        venueName: event?.venue_name ?? null,
      })
      return { reg, items }
    })
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My registrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Event registrations for competitors you manage. Upload payment
          receipts when an event requires fees.
        </p>
      </div>

      {!rows.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No registrations yet.{' '}
            <Link href="/member/events" className="text-primary underline">
              Browse events
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map(({ reg, items }) => {
            const event = reg.event as unknown as {
              id: string
              name: string
              status: string
              event_date: string | null
              payment_required?: boolean
              venue_name?: string | null
            } | null
            const competitor = reg.competitor as unknown as {
              id: string
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
                      <CardTitle className="text-lg">
                        {event?.name ?? 'Event'}
                      </CardTitle>
                      <CardDescription>
                        {competitor?.full_name}
                        {competitor?.public_id
                          ? ` · ${competitor.public_id}`
                          : ''}
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
                    Eligibility: {reg.eligibility_status} · Payment:{' '}
                    {reg.payment_status} · Waiver: {reg.waiver_status}
                  </div>
                  <EventPrepChecklist items={items} />
                  {(event?.payment_required ||
                    reg.payment_status !== 'not_required') && (
                    <PaymentReceiptPanel registrationId={reg.id} />
                  )}
                  {reg.entries && (
                    <div className="flex flex-wrap gap-2">
                      {(
                        reg.entries as unknown as Array<{
                          division: { id: string; name: string } | null
                        }>
                      ).map((e, i) =>
                        e.division ? (
                          <Button
                            key={`${e.division.id}-${i}`}
                            asChild
                            size="sm"
                            variant="ghost"
                          >
                            <Link
                              href={`/member/music?divisionId=${e.division.id}&competitorId=${competitor?.id || ''}`}
                            >
                              Music: {e.division.name}
                            </Link>
                          </Button>
                        ) : null
                      )}
                    </div>
                  )}
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
