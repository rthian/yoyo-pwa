/**
 * Division Detail Page
 * Manage participants and judges for a division
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Edit, Users, Trophy, Gavel } from 'lucide-react'
import DivisionParticipants from '@/components/admin/DivisionParticipants'
import DivisionJudges from '@/components/admin/DivisionJudges'
import ShareLeaderboardButton from '@/components/admin/ShareLeaderboardButton'

interface DivisionDetailPageProps {
  params: Promise<{ id: string; divisionId: string }>
}

export default async function DivisionDetailPage({ params }: DivisionDetailPageProps) {
  const { id: eventId, divisionId } = await params
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()

  // Get division with event info
  const { data: division, error } = await supabase
    .from('divisions')
    .select(`
      *,
      event:events(id, name, status)
    `)
    .eq('id', divisionId)
    .single()

  if (error || !division) {
    notFound()
  }

  // Get participants count
  const { count: participantCount } = await supabase
    .from('division_members')
    .select('*', { count: 'exact', head: true })
    .eq('division_id', divisionId)

  // Get judges count
  const { count: judgeCount } = await supabase
    .from('division_judges')
    .select('*', { count: 'exact', head: true })
    .eq('division_id', divisionId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link 
            href={`/admin/events/${eventId}`}
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
          <ShareLeaderboardButton 
            divisionId={divisionId} 
            divisionName={division.name} 
          />
          <Link href={`/admin/events/${eventId}/divisions/${divisionId}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Badge variant={division.is_active ? 'default' : 'secondary'} className="text-sm">
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
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Trophy className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium capitalize">{division.scoring_type.replace('_', ' ')}</p>
              <p className="text-sm text-muted-foreground">Scoring Type</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Participants and Judges */}
      <Tabs defaultValue="participants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="participants" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participants
          </TabsTrigger>
          <TabsTrigger value="judges" className="flex items-center gap-2">
            <Gavel className="h-4 w-4" />
            Judges
          </TabsTrigger>
        </TabsList>

        <TabsContent value="participants">
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>
                Manage competitors in this division
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DivisionParticipants divisionId={divisionId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="judges">
          <Card>
            <CardHeader>
              <CardTitle>Judges</CardTitle>
              <CardDescription>
                Assign judges to this division
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DivisionJudges divisionId={divisionId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
