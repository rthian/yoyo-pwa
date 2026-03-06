/**
 * Lock Division Button
 * Head judges and admins can lock/unlock scoring for a division
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Lock, Unlock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface LockDivisionButtonProps {
  divisionId: string
  scoringLocked: boolean
  isHeadJudgeOrAdmin: boolean
}

export default function LockDivisionButton({
  divisionId,
  scoringLocked,
  isHeadJudgeOrAdmin,
}: LockDivisionButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (!isHeadJudgeOrAdmin) return null

  const handleToggle = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/divisions/${divisionId}/lock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoring_locked: !scoringLocked }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update lock status')
      }

      toast.success(scoringLocked ? 'Division unlocked' : 'Division locked')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={scoringLocked ? 'default' : 'outline'}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : scoringLocked ? (
        <>
          <Unlock className="h-4 w-4" />
          Unlock Division
        </>
      ) : (
        <>
          <Lock className="h-4 w-4" />
          Lock Division
        </>
      )}
    </Button>
  )
}
