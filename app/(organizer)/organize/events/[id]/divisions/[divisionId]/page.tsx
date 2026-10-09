/**
 * Prompt 16: organizer division ops (participants, judges, music, share).
 * Callers: Next.js /organize/events/[id]/divisions/[divisionId]; DivisionsList links
 * Glob: no prior organize division page; reuses admin panels
 * User: "ok continue next"
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Edit, Users, Trophy, Gavel } from 'lucide-react'
import DivisionParticipants from '@/components/admin/DivisionParticipants'
import DivisionJudges from '@/components/admin/DivisionJudges'
import ShareLeaderboardButton from '@/components/admin/ShareLeaderboardButton'
import MusicReadinessPanel from '@/components/admin/MusicReadinessPanel'
import { createClient } from '@/lib/supabase/server'
import { resolveOrganizeCaps } from '@/lib/organize/access'

const BASE = '/organize'

interface PageProps {
  params: Promise<{ id: string; divisionId: string }>
}

export default async function OrganizeDivisionPage({ params }: PageProps) {
  const { id: eventId, divisionId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(
      `/login?redirect=/organize/events/${eventId}/divisions/${divisionId}`
    )
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { caps, canView } = await resolveOrganizeCaps(admin, user.id, eventId)
  if (!canView) redirect('/unauthorized')

  const { data: division, error } = await admin
    .from('divisions')
    .select(`*, event:events(id, name, status)`)
    .eq('id', divisionId)
    .single()

  if (error || !division || division.event_id !== eventId) notFound()

  const { count: participantCount } = await admin
    .from('division_members')
    .select('*', { count: 'exact', head: true })
    .eq('division_id', divisionId)

  const { count: judgeCount } = await admin
    .from('division_judges')
    .select('*', { count: 'exact', head: true })
    .eq('division_id', divisionId)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link
            href={`${BASE}/events/${eventId}`}
            className="flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to {division.event.name}
          </Link>
          <h1 className="text-3xl font-bold">{division.name}</h1>
          {division.description && (
            <p className="text-muted-foreground">{division.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {caps.manage_leaderboard_tokens && (
            <ShareLeaderboardButton
              divisionId={divisionId}
              divisionName={division.name}
            />
          )}
          {caps.manage_divisions && (
            <Link
              href={`${BASE}/events/${eventId}/divisions/${divisionId}/edit`}
            >
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Badge
              variant={division.is_active ? 'default' : 'secondary'}
              className="text-sm"
            >
              {division.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-xl font-bold">{participantCount || 0}</p>
              <p className="text-sm text-muted-foreground">Participants</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Gavel className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-xl font-bold">{judgeCount || 0}</p>
              <p className="text-sm text-muted-foreground">Judges</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="participants">
        <TabsList>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          {(caps.assign_judges || caps.view_ops) && (
            <TabsTrigger value="judges">Judges</TabsTrigger>
          )}
          {(caps.manage_music || caps.view_ops) && (
            <TabsTrigger value="music">Music</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="participants">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Participants
              </CardTitle>
              <CardDescription>
                Enrollment, play order, and check-in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DivisionParticipants divisionId={divisionId} />
            </CardContent>
          </Card>
        </TabsContent>

        {(caps.assign_judges || caps.view_ops) && (
          <TabsContent value="judges">
            <Card>
              <CardHeader>
                <CardTitle>Judges</CardTitle>
                <CardDescription>
                  Assign judges and leaderboard inclusion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DivisionJudges divisionId={divisionId} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {(caps.manage_music || caps.view_ops) && (
          <TabsContent value="music">
            <Card>
              <CardHeader>
                <CardTitle>Music readiness</CardTitle>
                <CardDescription>
                  Per-competitor submission status for this division
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MusicReadinessPanel
                  divisionId={divisionId}
                  eventId={eventId}
                  basePath={BASE}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
