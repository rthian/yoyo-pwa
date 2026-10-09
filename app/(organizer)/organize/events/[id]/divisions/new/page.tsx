/**
 * Prompt 16: create division under organizer shell.
 * Callers: organize/events/[id]/page.tsx Add Division → /organize/events/:id/divisions/new
 * Glob: no prior organize divisions/new (admin has admin/.../divisions/new)
 * No data-file I/O; POST /api/divisions via DivisionForm
 * User: "ok continue next"
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import DivisionForm from '@/components/admin/DivisionForm'
import { createClient } from '@/lib/supabase/server'
import { resolveOrganizeCaps } from '@/lib/organize/access'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrganizeNewDivisionPage({ params }: PageProps) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?redirect=/organize/events/${eventId}/divisions/new`)
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { caps } = await resolveOrganizeCaps(admin, user.id, eventId)
  if (!caps.manage_divisions) redirect('/unauthorized')

  const { data: event, error } = await admin
    .from('events')
    .select('id, name')
    .eq('id', eventId)
    .single()
  if (error || !event) notFound()

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/organize/events/${eventId}`}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to {event.name}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Add division</CardTitle>
          <CardDescription>
            Create a competition division for this event
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DivisionForm eventId={eventId} basePath="/organize" />
        </CardContent>
      </Card>
    </div>
  )
}
