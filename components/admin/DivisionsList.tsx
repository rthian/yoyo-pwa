/**
 * Divisions List Component
 * Displays divisions for an event with management actions
 */
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Trash2, Users, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import type { Division } from '@/lib/types/database'

interface DivisionsListProps {
  divisions: Division[]
  eventId: string
}

export default function DivisionsList({ divisions, eventId }: DivisionsListProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async (divisionId: string, divisionName: string) => {
    if (!confirm(`Are you sure you want to delete "${divisionName}"? This will also delete all related scores.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('divisions')
        .delete()
        .eq('id', divisionId)

      if (error) throw error

      toast.success('Division deleted')
      router.refresh()
    } catch (error) {
      console.error('Error deleting division:', error)
      toast.error('Failed to delete division')
    }
  }

  if (divisions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No divisions yet. Add your first division to get started.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Scoring Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {divisions.map((division) => (
          <TableRow key={division.id}>
            <TableCell>
              <Link 
                href={`/admin/events/${eventId}/divisions/${division.id}`}
                className="font-medium hover:underline"
              >
                {division.name}
              </Link>
              {division.description && (
                <p className="text-sm text-muted-foreground truncate max-w-xs">
                  {division.description}
                </p>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="capitalize">
                {division.scoring_type.replace('_', ' ')}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={division.is_active ? 'default' : 'secondary'}>
                {division.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/events/${eventId}/divisions/${division.id}`}>
                      <Users className="h-4 w-4 mr-2" />
                      Manage Participants
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/events/${eventId}/divisions/${division.id}/edit`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDelete(division.id, division.name)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
