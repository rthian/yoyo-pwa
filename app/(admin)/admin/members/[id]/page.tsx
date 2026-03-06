/**
 * Member Detail Page
 * Shows member details and event participation history
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Mail, Globe, Calendar, Trophy } from 'lucide-react'

interface MemberDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const { id } = await params
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()

  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !member) {
    notFound()
  }

  // Get participation history
  const { data: participations } = await supabase
    .from('division_members')
    .select(`
      *,
      division:divisions(
        name,
        event:events(id, name, event_date, status)
      )
    `)
    .eq('member_id', id)
    .order('created_at', { ascending: false })

  // Get judging assignments
  const { data: judgeAssignments } = await supabase
    .from('division_judges')
    .select(`
      *,
      division:divisions(
        name,
        event:events(id, name, event_date, status)
      )
    `)
    .eq('member_id', id)
    .order('created_at', { ascending: false })

  const roleColor: Record<string, 'destructive' | 'default' | 'secondary'> = {
    admin: 'destructive',
    judge: 'default',
    member: 'secondary',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link 
            href="/admin/members"
            className="flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Members
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{member.full_name}</h1>
            <Badge variant={roleColor[member.role]}>{member.role}</Badge>
            {!member.is_active && (
              <Badge variant="outline">Inactive</Badge>
            )}
          </div>
          {member.nickname && (
            <p className="text-muted-foreground">&ldquo;{member.nickname}&rdquo;</p>
          )}
        </div>
        <Link href={`/admin/members/${id}/edit`}>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Member Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${member.email}`} className="hover:underline">
                {member.email}
              </a>
            </div>
            {member.country && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                {member.country}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Joined {new Date(member.created_at).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Events Participated</span>
              <span className="font-medium">{participations?.length || 0}</span>
            </div>
            {(member.role === 'judge' || member.role === 'admin') && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Events Judged</span>
                <span className="font-medium">{judgeAssignments?.length || 0}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Participation History */}
      {participations && participations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event Participation</CardTitle>
            <CardDescription>
              Events this member has competed in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {participations.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/events/${p.division?.event?.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{p.division?.event?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.division?.name} • {p.division?.event?.event_date || 'No date'}
                    </p>
                  </div>
                  <Badge variant="outline">{p.status}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Judging History */}
      {judgeAssignments && judgeAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Judging Assignments
            </CardTitle>
            <CardDescription>
              Divisions this member has judged
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {judgeAssignments.map((j) => (
                <Link
                  key={j.id}
                  href={`/admin/events/${j.division?.event?.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{j.division?.event?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {j.division?.name} • {j.judge_type}
                    </p>
                  </div>
                  <Badge variant="outline">{j.division?.event?.status}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
