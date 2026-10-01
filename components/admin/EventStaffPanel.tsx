/**
 * Admin UI to grant/revoke event-scoped staff roles.
 * Calls GET|POST|DELETE /api/events/:id/staff.
 */
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import type { EventStaffRole, EventStaffRoleRow } from '@/lib/types/database'

interface EventStaffPanelProps {
  eventId: string
}

type StaffAccount = {
  id: string
  full_name: string
  email: string
  role: string
}

type StaffRow = EventStaffRoleRow & {
  account: StaffAccount | null
}

const ROLE_LABELS: Record<EventStaffRole, string> = {
  owner: 'Owner',
  organizer: 'Organizer',
  registration_manager: 'Registration manager',
  music_manager: 'Music manager',
  head_judge: 'Head judge (event)',
  stage_manager: 'Stage manager',
  readonly_staff: 'Read-only staff',
}

const ALL_ROLES = Object.keys(ROLE_LABELS) as EventStaffRole[]

export default function EventStaffPanel({ eventId }: EventStaffPanelProps) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [availableMembers, setAvailableMembers] = useState<StaffAccount[]>([])
  const [canManageStaff, setCanManageStaff] = useState(false)
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedRole, setSelectedRole] = useState<EventStaffRole>('organizer')

  const grantableRoles = ALL_ROLES.filter(
    (role) => role !== 'owner' || isGlobalAdmin
  )

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/staff`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load staff')
      setStaff(data.staff || [])
      setAvailableMembers(data.availableMembers || [])
      setCanManageStaff(Boolean(data.canManageStaff))
      setIsGlobalAdmin(Boolean(data.isGlobalAdmin))
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const handleGrant = async () => {
    if (!selectedAccountId || !selectedRole) return
    setAdding(true)
    try {
      const res = await fetch(`/api/events/${eventId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccountId,
          role: selectedRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to grant role')
      toast.success('Staff role granted')
      setSelectedAccountId('')
      setSelectedRole('organizer')
      setAddOpen(false)
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to grant role')
    } finally {
      setAdding(false)
    }
  }

  const handleRevoke = async (row: StaffRow) => {
    if (row.role === 'owner' && !isGlobalAdmin) {
      toast.error('Only global admins can revoke owner')
      return
    }
    if (!confirm(`Revoke ${ROLE_LABELS[row.role]} from ${row.account?.full_name ?? 'this account'}?`)) {
      return
    }
    try {
      const res = await fetch(`/api/events/${eventId}/staff`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: row.account_id,
          role: row.role,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to revoke role')
      toast.success('Staff role revoked')
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke role')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading staff…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Event-scoped roles. Global admins always retain full access.
        </p>
        {canManageStaff && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Grant role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant event staff role</DialogTitle>
                <DialogDescription>
                  Assign an account a role on this event only.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Account</label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name} ({m.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select
                    value={selectedRole}
                    onValueChange={(v) => setSelectedRole(v as EventStaffRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {grantableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleGrant}
                  disabled={!selectedAccountId || adding}
                >
                  {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Grant
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {staff.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No event staff roles yet.
          {canManageStaff
            ? ' Grant a role to get started.'
            : ' Ask an event owner or admin to grant access.'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Granted</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">
                    {row.account?.full_name ?? 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.account?.email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={row.role === 'owner' ? 'default' : 'secondary'}>
                    {ROLE_LABELS[row.role]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(row.granted_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {canManageStaff && (row.role !== 'owner' || isGlobalAdmin) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevoke(row)}
                      aria-label="Revoke role"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
