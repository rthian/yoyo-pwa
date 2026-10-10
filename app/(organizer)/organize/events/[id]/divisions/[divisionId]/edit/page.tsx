/**
 * Prompt 16: edit division (manage_divisions).
 * 1. Callers: organize division Edit button
 * 2. Glob: no prior organize division edit
 * 3. Sample: DivisionForm with basePath "/organize/events"
 * 4. User: "ok let do Prompt 16"
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import DivisionForm from '@/components/admin/DivisionForm'
import { requireEventStaff } from '@/lib/organize/access'

export default async function OrganizeDivisionEditPage({
  params,
}: {
  params: Promise<{ id: string; divisionId: string }>
}) {
  const { id: eventId, divisionId } = await params
  const { supabaseAdmin } = await requireEventStaff(eventId, 'manage_divisions')

  const { data: division, error } = await supabaseAdmin
    .from('divisions')
    .select('*')
    .eq('id', divisionId)
    .eq('event_id', eventId)
    .single()

  if (error || !division) notFound()

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href={`/organize/events/${eventId}/divisions/${divisionId}`}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to division
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit division</CardTitle>
          <CardDescription>{division.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <DivisionForm
            eventId={eventId}
            division={division}
            basePath="/organize/events"
          />
        </CardContent>
      </Card>
    </div>
  )
}
