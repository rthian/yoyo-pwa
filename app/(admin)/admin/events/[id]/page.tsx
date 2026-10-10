/**
 * Event Detail Page
 * Shows event details with divisions management
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Edit,
  Plus,
  Users,
  Trophy
} from 'lucide-react'
import DivisionsList from '@/components/admin/DivisionsList'
import EventStatusActions from '@/components/admin/EventStatusActions'
import DeleteEventButton from '@/components/admin/DeleteEventButton'
import ScheduleManager from '@/components/admin/ScheduleManager'
import FinalizeEventPanel from '@/components/admin/FinalizeEventPanel'
import PublishResultsPanel from '@/components/admin/PublishResultsPanel'
import EventStaffPanel from '@/components/admin/EventStaffPanel'
import EventRegistrationsPanel from '@/components/admin/EventRegistrationsPanel'
import EventTracksPanel from '@/components/admin/EventTracksPanel'
import EventMusicOpsPanel from '@/components/admin/EventMusicOpsPanel'
import EventMediaPanel from '@/components/admin/EventMediaPanel'
import { formatInTimeZone } from '@/lib/events/timing'

interface EventDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function EventDetailPage({ params, searchParams }: EventDetailPageProps) {
  const { id } = await params
  const { tab: tabParam } = await searchParams
  const allowedTabs = new Set([
    'divisions',
    'tracks',
    'music',
    'media',
    'schedule',
    'registrations',
    'staff',
  ])
  const defaultTab =
    tabParam && allowedTabs.has(tabParam) ? tabParam : 'divisions'
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()

  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !event) {
    notFound()
  }

  // Get divisions for this event
  const { data: divisions } = await supabase
    .from('divisions')
    .select('*')
    .eq('event_id', id)
    .order('sort_order', { ascending: true })

  // Get participant count
  const { count: participantCount } = await supabase
    .from('division_members')
    .select('*', { count: 'exact', head: true })
    .in('division_id', divisions?.map(d => d.id) || [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link 
            href="/admin/events" 
            className="flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Events
          </Link>
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
            {(event.starts_at || event.event_date) && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {event.starts_at
                  ? formatInTimeZone(event.starts_at, event.timezone || 'UTC')
                  : new Date(event.event_date).toLocaleDateString()}
                {event.timezone ? ` (${event.timezone})` : ''}
              </span>
            )}
            {(event.venue_name || event.location) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.venue_name || event.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/events/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <DeleteEventButton eventId={id} eventName={event.name} />
        </div>
      </div>

      {/* Status and Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <EventStatusActions event={event} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Trophy className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{divisions?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Divisions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{participantCount || 0}</p>
              <p className="text-sm text-muted-foreground">Participants</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {event.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{event.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Official results publish + league points finalization */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PublishResultsPanel eventId={id} />
        <FinalizeEventPanel eventId={id} />
      </div>

      {/* Divisions & Schedule Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="divisions">Divisions</TabsTrigger>
          <TabsTrigger value="tracks">Tracks</TabsTrigger>
          <TabsTrigger value="music">Music ops</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="divisions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Divisions</CardTitle>
                <CardDescription>
                  Manage competition divisions for this event
                </CardDescription>
              </div>
              <Link href={`/admin/events/${id}/divisions/new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Division
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <DivisionsList divisions={divisions || []} eventId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracks">
          <Card>
            <CardHeader>
              <CardTitle>Competition tracks</CardTitle>
              <CardDescription>
                Group divisions as stages (Qualifier → Semi → Final). No automatic advancement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventTracksPanel eventId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="music">
          <Card>
            <CardHeader>
              <CardTitle>Stage music operations</CardTitle>
              <CardDescription>
                Readiness by stage, running order, offline preflight cache, emergency replace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventMusicOpsPanel eventId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>External media</CardTitle>
              <CardDescription>
                Livestreams, highlights, and photo albums (curated links with click-to-load embeds on the public hub)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventMediaPanel eventId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>Event Schedule</CardTitle>
              <CardDescription>
                Manage the event timeline including ceremonies, breaks, and registration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduleManager eventId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registrations">
          <Card>
            <CardHeader>
              <CardTitle>Registrations</CardTitle>
              <CardDescription>
                Event registration aggregate — confirm, waitlist, cancel, CSV export
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventRegistrationsPanel eventId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle>Event staff</CardTitle>
              <CardDescription>
                Grant organizer, registration, music, head judge, and other event-scoped roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventStaffPanel eventId={id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
