/**
 * Admin Judges List Page
 * Displays all judges with their assignments
 */
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Gavel, Calendar, Trophy } from 'lucide-react'

export default async function JudgesPage() {
  const supabase = createAdminClient()

  // Get all judges and admins (admins can also judge)
  const { data: judges, error } = await supabase
    .from('members')
    .select('*')
    .in('role', ['judge', 'admin'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error fetching judges:', error)
  }

  // Get assignment counts for each judge
  const judgeIds = judges?.map(j => j.id) || []
  const { data: assignments } = await supabase
    .from('division_judges')
    .select('member_id')
    .in('member_id', judgeIds.length > 0 ? judgeIds : [''])

  // Count assignments per judge
  const assignmentCounts = assignments?.reduce((acc, a) => {
    acc[a.member_id] = (acc[a.member_id] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  // Get active events count
  const { count: activeEventsCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Judges</h1>
          <p className="text-muted-foreground">
            Manage judges and their event assignments
          </p>
        </div>
        <Link href="/admin/members/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Judge
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Gavel className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{judges?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Available Judges</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{activeEventsCount || 0}</p>
              <p className="text-sm text-muted-foreground">Active Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Trophy className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{assignments?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Assignments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Judges Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Judges</CardTitle>
          <CardDescription>
            Click on a judge to view their profile and assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {judges && judges.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Country</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {judges.map((judge) => (
                  <TableRow key={judge.id}>
                    <TableCell>
                      <Link 
                        href={`/admin/members/${judge.id}`}
                        className="font-medium hover:underline"
                      >
                        {judge.full_name}
                      </Link>
                      {judge.nickname && (
                        <p className="text-sm text-muted-foreground">
                          "{judge.nickname}"
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {judge.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={judge.role === 'admin' ? 'destructive' : 'default'}>
                        {judge.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {assignmentCounts[judge.id] || 0} divisions
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {judge.country || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No judges found.</p>
              <p className="text-sm">Add a member with the "Judge" role to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
