/**
 * Scoring Form Component
 * Mobile-optimized form for entering scores
 */
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { ArrowLeft, Save, Send, Loader2, User, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import ClickerInput from './ClickerInput'
import type { Division, DivisionMember, Score, Member } from '@/lib/types/database'

interface ParticipantWithMember extends DivisionMember {
  member: Member
}

interface DivisionWithEvent extends Division {
  event: { id: string; name: string; status: string }
}

interface ScoringFormProps {
  division: DivisionWithEvent
  participant: ParticipantWithMember
  existingScore: Score | null
  judgeId: string
}

// Score field configuration
const scoreFields = [
  { key: 'ex_clicks', label: 'Clicks', min: 0, max: 999, step: 1, isInteger: true },
  { key: 'ex_pv', label: 'Positive/Variety', min: 0, max: 10, step: 0.5, isInteger: false },
  { key: 'ex_ch', label: 'Choreography', min: 0, max: 10, step: 0.5, isInteger: false },
  { key: 'ex_cons', label: 'Consistency', min: 0, max: 10, step: 0.5, isInteger: false },
  { key: 'ex_space', label: 'Use of Space', min: 0, max: 10, step: 0.5, isInteger: false },
  { key: 'ex_body', label: 'Body Control', min: 0, max: 10, step: 0.5, isInteger: false },
  { key: 'ex_showman', label: 'Showmanship', min: 0, max: 10, step: 0.5, isInteger: false },
  { key: 'ex_music', label: 'Music Use', min: 0, max: 10, step: 0.5, isInteger: false },
  { key: 'ex_construct', label: 'Construction', min: 0, max: 10, step: 0.5, isInteger: false },
  { key: 'ex_trick_div', label: 'Trick Diversity', min: 0, max: 10, step: 0.5, isInteger: false },
  { key: 'ex_deductions', label: 'Deductions', min: 0, max: 50, step: 1, isInteger: true },
] as const

type ScoreKey = typeof scoreFields[number]['key']

export default function ScoringForm({
  division,
  participant,
  existingScore,
  judgeId,
}: ScoringFormProps) {
  const router = useRouter()
  
  // Initialize scores from existing or defaults
  const [scores, setScores] = useState<Record<ScoreKey, number>>(() => {
    const initial: Record<string, number> = {}
    scoreFields.forEach(field => {
      initial[field.key] = existingScore?.[field.key as keyof Score] as number ?? 0
    })
    return initial as Record<ScoreKey, number>
  })

  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Calculate totals
  const calculateTotals = useCallback(() => {
    const technical = scores.ex_clicks * 0.1 + 
      scores.ex_pv + scores.ex_ch + scores.ex_cons
    
    const performance = scores.ex_space + scores.ex_body + 
      scores.ex_showman + scores.ex_music + 
      scores.ex_construct + scores.ex_trick_div

    const total = technical + performance - scores.ex_deductions

    return {
      technical: Math.max(0, technical),
      performance: Math.max(0, performance),
      total: Math.max(0, total),
    }
  }, [scores])

  const totals = calculateTotals()

  const handleScoreChange = (key: ScoreKey, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }))
  }

  const saveScore = async (isSubmit: boolean) => {
    const actionLabel = isSubmit ? setSubmitting : setSaving
    actionLabel(true)

    try {
      const scorePayload = {
        division_id: division.id,
        division_member_id: participant.id,
        ...scores,
        is_submitted: isSubmit,
      }

      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scorePayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save score')
      }

      toast.success(isSubmit ? 'Score submitted!' : 'Score saved as draft')
      
      if (isSubmit) {
        router.push(`/judge/divisions/${division.id}`)
      }
      
      router.refresh()
    } catch (error) {
      console.error('Error saving score:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save score')
    } finally {
      actionLabel(false)
    }
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href={`/judge/divisions/${division.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">Score Entry</h1>
          <p className="text-sm text-muted-foreground truncate">
            {division.name}
          </p>
        </div>
        {existingScore?.is_submitted && (
          <Badge className="bg-green-100 text-green-700">Submitted</Badge>
        )}
      </div>

      {/* Participant Info */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg">{participant.member.full_name}</p>
            {participant.member.nickname && (
              <p className="text-muted-foreground">"{participant.member.nickname}"</p>
            )}
            {participant.member.country && (
              <p className="text-sm text-muted-foreground">{participant.member.country}</p>
            )}
          </div>
          <Badge variant="outline">#{participant.play_order || '?'}</Badge>
        </CardContent>
      </Card>

      {/* Technical Scores - large touch targets for eyes-free use */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base tracking-tight">Technical Execution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scoreFields.slice(0, 4).map(field => (
            <ClickerInput
              key={field.key}
              label={field.label}
              value={scores[field.key]}
              onChange={(v) => handleScoreChange(field.key, v)}
              min={field.min}
              max={field.max}
              step={field.step}
              isInteger={field.isInteger}
            />
          ))}
        </CardContent>
      </Card>

      {/* Performance Scores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base tracking-tight">Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scoreFields.slice(4, 10).map(field => (
            <ClickerInput
              key={field.key}
              label={field.label}
              value={scores[field.key]}
              onChange={(v) => handleScoreChange(field.key, v)}
              min={field.min}
              max={field.max}
              step={field.step}
              isInteger={field.isInteger}
            />
          ))}
        </CardContent>
      </Card>

      {/* Deductions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-destructive tracking-tight">Deductions</CardTitle>
        </CardHeader>
        <CardContent>
          <ClickerInput
            label={scoreFields[10].label}
            value={scores.ex_deductions}
            onChange={(v) => handleScoreChange('ex_deductions', v)}
            min={0}
            max={50}
            step={1}
            isInteger={true}
            variant="destructive"
          />
        </CardContent>
      </Card>

      {/* Totals - high contrast for dim stages (dark mode) */}
      <Card className="bg-primary/10 dark:bg-primary/20 border-primary/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Technical</p>
              <p className="text-xl font-bold font-mono tabular-nums">{totals.technical.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Performance</p>
              <p className="text-xl font-bold font-mono tabular-nums">{totals.performance.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-primary">{totals.total.toFixed(1)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fixed Action Bar */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t z-40 safe-area-bottom">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            className="flex-1 h-12 text-base"
            onClick={() => saveScore(false)}
            disabled={saving || submitting}
          >
            {saving ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Save className="h-5 w-5 mr-2" />
            )}
            Save Draft
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="flex-1 h-12 text-base"
                disabled={saving || submitting}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Send className="h-5 w-5 mr-2" />
                )}
                Submit
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-sm mx-4">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Confirm Submission
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-muted-foreground text-sm text-left space-y-2">
                    <span className="block">You are about to submit scores for:</span>
                    <span className="block font-semibold text-foreground">{participant.member.full_name}</span>
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Technical:</span>
                        <span className="font-medium">{totals.technical.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Performance:</span>
                        <span className="font-medium">{totals.performance.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                        <span>Total:</span>
                        <span className="text-primary">{totals.total.toFixed(1)}</span>
                      </div>
                    </div>
                    <span className="block text-xs text-muted-foreground mt-2">
                      This action cannot be easily undone.
                    </span>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-2">
                <AlertDialogCancel className="flex-1 m-0">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className="flex-1 m-0" 
                  onClick={() => saveScore(true)}
                >
                  Confirm Submit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
