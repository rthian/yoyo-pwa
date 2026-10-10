/**
 * Prompt 16: create division (manage_divisions).
 * 1. Callers: organize event Add Division
 * 2. Glob: no prior organize divisions/new
 * 3. Sample: DivisionForm eventId + basePath "/organize/events"
 * 4. User: "ok let do Prompt 16"
 */
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import DivisionForm from '@/components/admin/DivisionForm'
import { requireEventStaff } from '@/lib/organize/access'

export default async function OrganizeNewDivisionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = await params
  const { event } = await requireEventStaff(eventId, 'manage_divisions')

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href={`/organize/events/${eventId}`}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to {event.name}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Add division</CardTitle>
          <CardDescription>{event.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <DivisionForm eventId={eventId} basePath="/organize/events" />
        </CardContent>
      </Card>
    </div>
  )
}
