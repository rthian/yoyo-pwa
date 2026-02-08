/**
 * Division Participants Component
 * Manage participants in a division
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
import { Plus, Trash2, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { Member, DivisionMember, DivisionMemberStatus } from '@/lib/types/database'

interface DivisionParticipantsProps {
  divisionId: string
}

interface ParticipantWithMember extends DivisionMember {
  member: Member
}

const statusOptions: { value: DivisionMemberStatus; label: string }[] = [
  { value: 'registered', label: 'Registered' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'playing', label: 'Playing' },
  { value: 'completed', label: 'Completed' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

export default function DivisionParticipants({ divisionId }: DivisionParticipantsProps) {
  const [participants, setParticipants] = useState<ParticipantWithMember[]>([])
  const [availableMembers, setAvailableMembers] = useState<Member[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    
    try {
      const response = await fetch(`/api/divisions/${divisionId}/participants`)
      if (!response.ok) throw new Error('Failed to fetch participants')
      
      const data = await response.json()
      setParticipants(data.participants || [])
      setAvailableMembers(data.availableMembers || [])
    } catch (error) {
      console.error('Error fetching participants:', error)
      toast.error('Failed to load participants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [divisionId])

  const handleAdd = async () => {
    if (!selectedMemberId) return
    
    setAdding(true)
    
    try {
      const response = await fetch(`/api/divisions/${divisionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMemberId,
          play_order: participants.length + 1,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to add participant')
      }

      toast.success('Participant added')
      setSelectedMemberId('')
      setAddDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error adding participant:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add participant')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (participantId: string) => {
    if (!confirm('Remove this participant from the division?')) return

    try {
      const response = await fetch(`/api/divisions/${divisionId}/participants`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to remove participant')
      }

      toast.success('Participant removed')
      fetchData()
    } catch (error) {
      console.error('Error removing participant:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove participant')
    }
  }

  const handleStatusChange = async (participantId: string, newStatus: DivisionMemberStatus) => {
    try {
      const response = await fetch(`/api/divisions/${divisionId}/participants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, status: newStatus }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to update status')
      }

      toast.success('Status updated')
      fetchData()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update status')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Participant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Participant</DialogTitle>
              <DialogDescription>
                Select a member to add to this division
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No available members
                    </SelectItem>
                  ) : (
                    availableMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name} ({member.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={!selectedMemberId || adding}>
                  {adding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {participants.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No participants yet. Add members to this division.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((participant, index) => (
              <TableRow key={participant.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>{participant.member.full_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {participant.member.email}
                </TableCell>
                <TableCell>
                  <Select
                    value={participant.status}
                    onValueChange={(value) => 
                      handleStatusChange(participant.id, value as DivisionMemberStatus)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(participant.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
