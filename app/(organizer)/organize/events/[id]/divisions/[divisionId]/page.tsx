/**
 * Prompt 16: division ops for staff.
 * 1. Callers: DivisionsList under /organize
 * 2. Glob: no prior organize division page
 * 3. Sample division: { name: "1A Open", event_id: "evt_demo" }
 * 4. User: "ok let do Prompt 16"
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Edit, Users, Gavel } from 'lucide-react'
import DivisionParticipants from '@/components/admin/DivisionParticipants'
import DivisionJudges from '@/components/admin/DivisionJudges'
import ShareLeaderboardButton from '@/components/admin/ShareLeaderboardButton'
import MusicReadinessPanel from '@/components/admin/MusicReadinessPanel'
import { requireEventStaff } from '@/lib/organize/access'

export default async function OrganizeDivisionPage({
  params,
}: {
  params: Promise<{ id: string; divisionId: string }>
}) {
  const { id: eventId, divisionId } = await params
  const { capabilities, supabaseAdmin } = await requireEventStaff(eventId, 'view_ops')


  const { data: division, error } = await supabaseAdmin
    .from('divisions')
    .select(`*, event:events(id, name, status)`)
    .eq('id', divisionId)
    .eq('event_id', eventId)
    .single()

  if (error || !division) notFound()

  const { count: participantCount } = await supabaseAdmin
    .from('division_members')
    .select('*', { count: 'exact', head: true })
    .eq('division_id', divisionId)

  const { count: judgeCount } = await supabaseAdmin
    .from('division_judges')
    .select('*', { count: 'exact', head: true })
    .eq('division_id', divisionId)

  const eventName = Array.isArray(division.event)
    ? division.event[0]?.name
    : division.event?.name

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link
            href={`/organize/events/${eventId}`}
            className="flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to {eventName || 'event'}
          </Link>
          <h1 className="text-3xl font-bold">{division.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {capabilities.manage_leaderboard_tokens && (
            <ShareLeaderboardButton
              divisionId={divisionId}
              divisionName={division.name}
            />
          )}
          {capabilities.manage_divisions && (
            <Link
              href={`/organize/events/${eventId}/divisions/${divisionId}/edit`}
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
            <Badge variant={division.is_active ? 'default' : 'secondary'}>
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
          <TabsTrigger value="judges">Judges</TabsTrigger>
          <TabsTrigger value="music">Music</TabsTrigger>
        </TabsList>
        <TabsContent value="participants">
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>Enrollment and play order</CardDescription>
            </CardHeader>
            <CardContent>
              <DivisionParticipants
                divisionId={divisionId}
                canEnroll={capabilities.manage_registration}
                canReorder={capabilities.manage_play_order}
                canUpdateStatus={
                  capabilities.manage_registration || capabilities.check_in
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="judges">
          <Card>
            <CardHeader>
              <CardTitle>Judges</CardTitle>
            </CardHeader>
            <CardContent>
              <DivisionJudges divisionId={divisionId} readOnly={!capabilities.assign_judges} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="music">
          <Card>
            <CardHeader>
              <CardTitle>Music readiness</CardTitle>
            </CardHeader>
            <CardContent>
              <MusicReadinessPanel
                readOnly={!capabilities.manage_music}
                divisionId={divisionId}
                eventId={eventId}
                eventOpsHref={`/organize/events/${eventId}?tab=music`}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
