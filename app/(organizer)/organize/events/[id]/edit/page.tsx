/**
 * Prompt 16: edit event (manage_event).
 * 1. Callers: organize event Edit button → /organize/events/[id]/edit
 * 2. Glob: no prior organize edit page
 * 3. Sample: EventForm with basePath "/organize/events"
 * 4. User: "ok let do Prompt 16"
 */
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import EventForm from '@/components/admin/EventForm'
import { requireEventStaff } from '@/lib/organize/access'

export default async function OrganizeEventEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { event } = await requireEventStaff(id, 'manage_event')

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href={`/organize/events/${id}`}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to event
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit event</CardTitle>
          <CardDescription>{event.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm event={event} basePath="/organize/events" />
        </CardContent>
      </Card>
    </div>
  )
}
