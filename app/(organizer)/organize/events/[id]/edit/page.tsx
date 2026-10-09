/**
 * Prompt 16: edit event under organizer shell (manage_event).
 * Callers: organize event page Edit → /organize/events/[id]/edit
 * Glob: no prior organize event edit (admin has admin/.../edit)
 * User: "ok continue next"
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import EventForm from '@/components/admin/EventForm'
import { createClient } from '@/lib/supabase/server'
import { resolveOrganizeCaps } from '@/lib/organize/access'
import type { Event } from '@/lib/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrganizeEditEventPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/organize/events/${id}/edit`)

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { caps } = await resolveOrganizeCaps(admin, user.id, id)
  if (!caps.manage_event) redirect('/unauthorized')

  const { data: event, error } = await admin
    .from('events')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !event) notFound()

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/organize/events/${id}`}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to {event.name}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit event</CardTitle>
          <CardDescription>Update event details and timing</CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm event={event as Event} basePath="/organize" />
        </CardContent>
      </Card>
    </div>
  )
}
