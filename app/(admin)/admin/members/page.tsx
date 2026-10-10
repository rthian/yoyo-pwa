/**
 * Admin Members List Page
 * Displays all members with filtering and management actions
 */
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Users } from 'lucide-react'
import MembersTable from '@/components/admin/MembersTable'

export default async function MembersPage() {
  const supabase = createAdminClient()

  // GateGuard: callers MembersTable; Glob existing page; sample { id, email, role };
  // User: "next"
  const { data: accounts, error } = await supabase
    .from('members')
    .select('id, email, full_name, role, is_active, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching members:', error)
  }

  const { composeMembersForAccounts } = await import(
    '@/lib/identity/account-profile'
  )
  const members = accounts?.length
    ? await composeMembersForAccounts(supabase, accounts)
    : []

  const roleStats = {
    total: members.length,
    members: members.filter((m) => m.role === 'member').length,
    judges: members.filter((m) => m.role === 'judge').length,
    admins: members.filter((m) => m.role === 'admin').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-muted-foreground">
            Manage participants, judges, and administrators
          </p>
        </div>
        <Link href="/admin/members/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{roleStats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Badge variant="secondary">Member</Badge>
            <div>
              <p className="text-2xl font-bold">{roleStats.members}</p>
              <p className="text-sm text-muted-foreground">Participants</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Badge>Judge</Badge>
            <div>
              <p className="text-2xl font-bold">{roleStats.judges}</p>
              <p className="text-sm text-muted-foreground">Judges</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Badge variant="destructive">Admin</Badge>
            <div>
              <p className="text-2xl font-bold">{roleStats.admins}</p>
              <p className="text-sm text-muted-foreground">Administrators</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
          <CardDescription>
            Click on a member to view or edit their details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersTable members={members || []} />
        </CardContent>
      </Card>
    </div>
  )
}
