/**
 * Ruleset Delete Button Component
 * Handles soft-deletion of a ruleset with confirmation
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface RulesetDeleteButtonProps {
  rulesetId: string
  rulesetName: string
}

export default function RulesetDeleteButton({ rulesetId, rulesetName }: RulesetDeleteButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)

    try {
      const response = await fetch(`/api/rulesets/${rulesetId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          toast.error(`Cannot delete: ${result.error}`, {
            description: result.events
              ? `Used by: ${result.events.join(', ')}`
              : undefined,
          })
        } else {
          throw new Error(result.error || 'Failed to delete ruleset')
        }
        return
      }

      toast.success('Ruleset deleted successfully')
      router.push('/admin/rules')
      router.refresh()
    } catch (error) {
      console.error('Error deleting ruleset:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete ruleset')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="icon" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Ruleset</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{rulesetName}&quot;? This will deactivate
            the ruleset. Events currently using it will not be affected, but it will
            no longer be available for selection.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
