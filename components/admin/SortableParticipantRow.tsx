/**
 * Sortable Participant Row
 * Draggable table row for play order reordering (dnd-kit)
 */
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  TableCell,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { GripVertical, Trash2 } from 'lucide-react'
import type { Member, DivisionMember, DivisionMemberStatus } from '@/lib/types/database'

interface ParticipantWithMember extends DivisionMember {
  member: Member
}

interface SortableParticipantRowProps {
  participant: ParticipantWithMember
  index: number
  statusOptions: { value: DivisionMemberStatus; label: string }[]
  onStatusChange: (participantId: string, status: DivisionMemberStatus) => void
  onRemove: (participantId: string) => void
}

export default function SortableParticipantRow({
  participant,
  index,
  statusOptions,
  onStatusChange,
  onRemove,
}: SortableParticipantRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: participant.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-50 bg-muted/50' : ''}
    >
      <TableCell className="w-10 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </TableCell>
      <TableCell className="font-medium tabular-nums w-12">{index + 1}</TableCell>
      <TableCell>{participant.member.full_name}</TableCell>
      <TableCell className="text-muted-foreground">
        {participant.member.email}
      </TableCell>
      <TableCell>
        <Select
          value={participant.status}
          onValueChange={(value) =>
            onStatusChange(participant.id, value as DivisionMemberStatus)
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
      <TableCell className="text-right w-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(participant.id)}
          aria-label="Remove participant"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
