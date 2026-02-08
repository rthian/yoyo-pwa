/**
 * Event Detail Page
 * Shows event details with divisions management
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Edit, 
  Plus, 
  Users, 
  Trophy,
  Trash2 
} from 'lucide-react'
import DivisionsList from '@/components/admin/DivisionsList'
import EventStatusActions from '@/components/admin/EventStatusActions'
import DeleteEventButton from '@/components/admin/DeleteEventButton'
import ScheduleManager from '@/components/admin/ScheduleManager'

interface EventDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params
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
          <div className="flex items-center gap-4 text-muted-foreground">
            {event.event_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(event.event_date).toLocaleDateString()}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.location}
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

      {/* Divisions & Schedule Tabs */}
      <Tabs defaultValue="divisions">
        <TabsList>
          <TabsTrigger value="divisions">Divisions</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
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
      </Tabs>
    </div>
  )
}
