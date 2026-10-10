/**
 * Prompt 16: staffed-event card on /organize list.
 * 1. Callers: app/(organizer)/organize/page.tsx
 * 2. Glob: no prior OrganizeEntryCard
 * 3. Sample: { name: "Nationals", roles: ["organizer"], status: "published" }
 * 4. User: "ok let do Prompt 16"
 */
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, MapPin } from 'lucide-react'
import type { StaffedEventSummary } from '@/lib/organize/access'
import { formatInTimeZone } from '@/lib/events/timing'

export default function OrganizeEntryCard({ event }: { event: StaffedEventSummary }) {
  const when = event.starts_at
    ? formatInTimeZone(event.starts_at, event.timezone || 'UTC')
    : event.event_date
      ? new Date(event.event_date).toLocaleDateString()
      : null

  return (
    <Link href={`/organize/events/${event.id}`} className="block">
      <Card className="transition-colors hover:bg-muted/40">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-lg">{event.name}</CardTitle>
            <Badge variant="outline" className="capitalize">
              {event.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {when && (
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {when}
              {event.timezone ? ` (${event.timezone})` : ''}
            </p>
          )}
          {(event.venue_name || event.location) && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {event.venue_name || event.location}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {event.roles.map((role) => (
              <Badge key={role} variant="secondary" className="capitalize text-xs">
                {role.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
