/**
 * Division Participants Component
 * Manage participants in a division with drag-and-drop play order
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
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
import { Plus, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import SortableParticipantRow from './SortableParticipantRow'
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
  const [, setReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchData = useCallback(async () => {
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
  }, [divisionId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = participants.findIndex((p) => p.id === active.id)
    const newIndex = participants.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(participants, oldIndex, newIndex)
    setParticipants(reordered)

    setReordering(true)
    try {
      const response = await fetch(`/api/divisions/${divisionId}/participants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIds: reordered.map((p) => p.id),
        }),
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to reorder')
      }
      toast.success('Play order updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reorder')
      fetchData()
    } finally {
      setReordering(false)
    }
  }

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" aria-label="Drag to reorder" />
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={participants.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {participants.map((participant, index) => (
                  <SortableParticipantRow
                    key={participant.id}
                    participant={participant}
                    index={index}
                    statusOptions={statusOptions}
                    onStatusChange={handleStatusChange}
                    onRemove={handleRemove}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      )}
    </div>
  )
}
