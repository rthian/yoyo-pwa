/**
 * Division Judges Component
 * Manage judges assigned to a division
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
import { Plus, Trash2, Loader2, Gavel } from 'lucide-react'
import { toast } from 'sonner'
import type { Member, DivisionJudge, JudgeType } from '@/lib/types/database'

interface DivisionJudgesProps {
  divisionId: string
}

interface JudgeWithMember extends DivisionJudge {
  member: Member
}

const judgeTypeOptions: { value: JudgeType; label: string }[] = [
  { value: 'head', label: 'Head Judge' },
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Technical' },
  { value: 'performance', label: 'Performance' },
]

export default function DivisionJudges({ divisionId }: DivisionJudgesProps) {
  const [judges, setJudges] = useState<JudgeWithMember[]>([])
  const [availableJudges, setAvailableJudges] = useState<Member[]>([])
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>('')
  const [selectedJudgeType, setSelectedJudgeType] = useState<JudgeType>('general')
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    
    try {
      const response = await fetch(`/api/divisions/${divisionId}/judges`)
      if (!response.ok) throw new Error('Failed to fetch judges')
      
      const data = await response.json()
      setJudges(data.judges || [])
      setAvailableJudges(data.availableJudges || [])
    } catch (error) {
      console.error('Error fetching judges:', error)
      toast.error('Failed to load judges')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [divisionId])

  const handleAdd = async () => {
    if (!selectedJudgeId) return
    
    setAdding(true)
    
    try {
      const response = await fetch(`/api/divisions/${divisionId}/judges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedJudgeId,
          judge_type: selectedJudgeType,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to assign judge')
      }

      toast.success('Judge assigned')
      setSelectedJudgeId('')
      setSelectedJudgeType('general')
      setAddDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error assigning judge:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to assign judge')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (assignmentId: string) => {
    if (!confirm('Remove this judge from the division?')) return

    try {
      const response = await fetch(`/api/divisions/${divisionId}/judges`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to remove judge')
      }

      toast.success('Judge removed')
      fetchData()
    } catch (error) {
      console.error('Error removing judge:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove judge')
    }
  }

  const handleTypeChange = async (assignmentId: string, newType: JudgeType) => {
    try {
      const response = await fetch(`/api/divisions/${divisionId}/judges`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, judge_type: newType }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to update judge type')
      }

      toast.success('Judge type updated')
      fetchData()
    } catch (error) {
      console.error('Error updating judge type:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update judge type')
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
              Assign Judge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Judge</DialogTitle>
              <DialogDescription>
                Select a judge to assign to this division
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Judge</label>
                <Select value={selectedJudgeId} onValueChange={setSelectedJudgeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a judge" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableJudges.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No available judges
                      </SelectItem>
                    ) : (
                      availableJudges.map((judge) => (
                        <SelectItem key={judge.id} value={judge.id}>
                          {judge.full_name} ({judge.role})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Judge Type</label>
                <Select 
                  value={selectedJudgeType} 
                  onValueChange={(value) => setSelectedJudgeType(value as JudgeType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {judgeTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={!selectedJudgeId || adding}>
                  {adding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    'Assign'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {judges.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No judges assigned yet. Assign judges to enable scoring.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {judges.map((judge) => (
              <TableRow key={judge.id}>
                <TableCell className="font-medium">{judge.member.full_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {judge.member.email}
                </TableCell>
                <TableCell>
                  <Select
                    value={judge.judge_type}
                    onValueChange={(value) => 
                      handleTypeChange(judge.id, value as JudgeType)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {judgeTypeOptions.map((option) => (
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
                    onClick={() => handleRemove(judge.id)}
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
