/**
 * Prompt 16: capability-gated event ops hub for staff (reuses admin panels).
 * Callers: Next.js route /organize/events/[id]; linked from organize/page.tsx
 * Glob: no prior organize event page; panels from components/admin/*
 * Caps sample: { manage_divisions: true, manage_music: false, view_ops: true }
 * User: "ok continue next"
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Edit,
  Plus,
  Users,
  Trophy,
} from 'lucide-react'
import DivisionsList from '@/components/admin/DivisionsList'
import EventStatusActions from '@/components/admin/EventStatusActions'
import DeleteEventButton from '@/components/admin/DeleteEventButton'
import ScheduleManager from '@/components/admin/ScheduleManager'
import PublishResultsPanel from '@/components/admin/PublishResultsPanel'
import FinalizeEventPanel from '@/components/admin/FinalizeEventPanel'
import EventStaffPanel from '@/components/admin/EventStaffPanel'
import EventRegistrationsPanel from '@/components/admin/EventRegistrationsPanel'
import EventTracksPanel from '@/components/admin/EventTracksPanel'
import EventMusicOpsPanel from '@/components/admin/EventMusicOpsPanel'
import EventMediaPanel from '@/components/admin/EventMediaPanel'
import { formatInTimeZone } from '@/lib/events/timing'
import { createClient } from '@/lib/supabase/server'
import { resolveOrganizeCaps } from '@/lib/organize/access'

const BASE = '/organize'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function OrganizeEventPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { tab: tabParam } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/organize/events/${id}`)

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { caps, canView, roles, isAdmin } = await resolveOrganizeCaps(
    admin,
    user.id,
    id
  )
  if (!canView) redirect('/unauthorized')

  const { data: event, error } = await admin
    .from('events')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !event) notFound()

  const { data: divisions } = await admin
    .from('divisions')
    .select('*')
    .eq('event_id', id)
    .order('sort_order', { ascending: true })

  const divisionIds = (divisions ?? []).map((d) => d.id)
  const { count: participantCount } = divisionIds.length
    ? await admin
        .from('division_members')
        .select('*', { count: 'exact', head: true })
        .in('division_id', divisionIds)
    : { count: 0 }

  const tabDefs = [
    { id: 'divisions', label: 'Divisions', show: caps.view_ops },
    { id: 'tracks', label: 'Tracks', show: caps.manage_divisions },
    { id: 'music', label: 'Music ops', show: caps.manage_music || caps.view_ops },
    { id: 'media', label: 'Media', show: caps.manage_event || caps.view_ops },
    { id: 'schedule', label: 'Schedule', show: caps.manage_schedule || caps.view_ops },
    {
      id: 'registrations',
      label: 'Registrations',
      show: caps.manage_registration || caps.view_ops,
    },
    { id: 'staff', label: 'Staff', show: caps.manage_staff || caps.view_ops },
  ].filter((t) => t.show)

  const allowed = new Set(tabDefs.map((t) => t.id))
  const defaultTab =
    tabParam && allowed.has(tabParam)
      ? tabParam
      : tabDefs[0]?.id || 'divisions'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link
            href="/organize"
            className="flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to My events
          </Link>
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <div className="flex items-center gap-4 text-muted-foreground flex-wrap text-sm">
            {(event.starts_at || event.event_date) && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {event.starts_at
                  ? formatInTimeZone(event.starts_at, event.timezone || 'UTC')
                  : new Date(event.event_date).toLocaleDateString()}
              </span>
            )}
            {(event.venue_name || event.location) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.venue_name || event.location}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="capitalize">
                {r.replace(/_/g, ' ')}
              </Badge>
            ))}
            {isAdmin && <Badge variant="outline">global admin</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {caps.manage_event && (
            <Link href={`${BASE}/events/${id}/edit`}>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          )}
          {caps.delete_event && (
            <DeleteEventButton
              eventId={id}
              eventName={event.name}
              redirectTo="/organize"
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {caps.manage_event && (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <EventStatusActions event={event} />
            </CardContent>
          </Card>
        )}
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

      {(caps.publish_results || caps.finalize_results) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {caps.publish_results && <PublishResultsPanel eventId={id} />}
          {caps.finalize_results && <FinalizeEventPanel eventId={id} />}
        </div>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {tabDefs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {allowed.has('divisions') && (
          <TabsContent value="divisions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Divisions</CardTitle>
                  <CardDescription>
                    Competition divisions for this event
                  </CardDescription>
                </div>
                {caps.manage_divisions && (
                  <Link href={`${BASE}/events/${id}/divisions/new`}>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Division
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                <DivisionsList
                  divisions={divisions || []}
                  eventId={id}
                  basePath={BASE}
                  canManage={caps.manage_divisions}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allowed.has('tracks') && (
          <TabsContent value="tracks">
            <Card>
              <CardHeader>
                <CardTitle>Competition tracks</CardTitle>
                <CardDescription>
                  Group divisions as stages (no automatic advancement)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventTracksPanel eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allowed.has('music') && (
          <TabsContent value="music">
            <Card>
              <CardHeader>
                <CardTitle>Stage music operations</CardTitle>
                <CardDescription>
                  Readiness, playlist, offline preflight, emergency replace
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventMusicOpsPanel eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allowed.has('media') && (
          <TabsContent value="media">
            <Card>
              <CardHeader>
                <CardTitle>External media</CardTitle>
                <CardDescription>
                  Livestreams, highlights, and albums
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventMediaPanel eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allowed.has('schedule') && (
          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Event schedule</CardTitle>
                <CardDescription>
                  Ceremonies, breaks, and registration windows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScheduleManager eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allowed.has('registrations') && (
          <TabsContent value="registrations">
            <Card>
              <CardHeader>
                <CardTitle>Registrations</CardTitle>
                <CardDescription>
                  Confirm, waitlist, cancel, CSV export
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventRegistrationsPanel eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allowed.has('staff') && (
          <TabsContent value="staff">
            <Card>
              <CardHeader>
                <CardTitle>Event staff</CardTitle>
                <CardDescription>
                  {caps.manage_staff
                    ? 'Grant and revoke event-scoped roles'
                    : 'View staff assignments (read-only)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventStaffPanel eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
