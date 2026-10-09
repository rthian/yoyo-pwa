/**
 * Prompt 16: edit division under organizer shell.
 * Callers: organize division page Edit → .../divisions/[divisionId]/edit
 * Glob: no prior organize division edit
 * User: "ok continue next"
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import DivisionForm from '@/components/admin/DivisionForm'
import { createClient } from '@/lib/supabase/server'
import { resolveOrganizeCaps } from '@/lib/organize/access'
import type { Division } from '@/lib/types/database'

interface PageProps {
  params: Promise<{ id: string; divisionId: string }>
}

export default async function OrganizeEditDivisionPage({ params }: PageProps) {
  const { id: eventId, divisionId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(
      `/login?redirect=/organize/events/${eventId}/divisions/${divisionId}/edit`
    )
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { caps } = await resolveOrganizeCaps(admin, user.id, eventId)
  if (!caps.manage_divisions) redirect('/unauthorized')

  const { data: division, error } = await admin
    .from('divisions')
    .select('*')
    .eq('id', divisionId)
    .single()

  if (error || !division || division.event_id !== eventId) notFound()

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/organize/events/${eventId}/divisions/${divisionId}`}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to {division.name}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit division</CardTitle>
          <CardDescription>Update division settings</CardDescription>
        </CardHeader>
        <CardContent>
          <DivisionForm
            eventId={eventId}
            division={division as Division}
            basePath="/organize"
          />
        </CardContent>
      </Card>
    </div>
  )
}
