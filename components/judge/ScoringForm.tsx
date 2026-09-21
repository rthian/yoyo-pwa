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
import JudgeRulesSheet from './JudgeRulesSheet'
import { generateClientId, saveOfflineScore } from '@/lib/offline/queue'
import type { Division, DivisionMember, Score, Member, Ruleset, ScoringType } from '@/lib/types/database'

interface ParticipantWithMember extends DivisionMember {
  member: Member
}

type JudgeRuleset = Pick<
  Ruleset,
  'id' | 'name' | 'code' | 'version' | 'source_url' | 'rules_content' | 'scoring_config'
>

interface DivisionWithEvent extends Division {
  event: {
    id: string
    name: string
    status: string
    ruleset_id?: string | null
    ruleset?: JudgeRuleset | JudgeRuleset[] | null
  }
}

interface ScoringFormProps {
  division: DivisionWithEvent
  participant: ParticipantWithMember
  existingScore: Score | null
  judgeId: string
}

function oneRuleset(
  value: JudgeRuleset | JudgeRuleset[] | null | undefined
): JudgeRuleset | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

const scoringTypeLabels: Record<ScoringType, string> = {
  standard: 'Standard',
  clicker: 'Clicker',
  head_to_head: 'H2H',
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
  const event = Array.isArray(division.event) ? division.event[0] : division.event
  const ruleset = oneRuleset(event?.ruleset)
  const scoringType = (division.scoring_type || 'standard') as ScoringType


  const handleScoreChange = (key: ScoreKey, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }))
  }

  const saveOffline = async () => {
    await saveOfflineScore({
      clientId: generateClientId(),
      divisionId: division.id,
      divisionMemberId: participant.id,
      judgeId,
      scoreData: scores,
      timestamp: Date.now(),
    })
    toast.success('Saved offline — will sync when you are back online')
  }

  const saveScore = async (isSubmit: boolean) => {
    const actionLabel = isSubmit ? setSubmitting : setSaving
    actionLabel(true)

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await saveOffline()
        return
      }

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
      const offline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        (error instanceof TypeError)
      if (offline) {
        try {
          await saveOffline()
          return
        } catch (queueErr) {
          console.error(queueErr)
        }
      }
      console.error('Error saving score:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save score')
    } finally {
      actionLabel(false)
    }
  }

  return (
    <div className="space-y-4 pb-44">
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2">
          <Link href={`/judge/divisions/${division.id}`}>
            <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">{participant.member.full_name}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {division.name}
              {participant.play_order != null ? ` · #${participant.play_order}` : ''}
            </p>
          </div>
          <Badge variant="outline" className="rounded-full shrink-0">
            {scoringTypeLabels[scoringType]}
          </Badge>
          <JudgeRulesSheet
            ruleset={ruleset}
            scoringType={scoringType}
            roundType={division.round_type}
          />
          {existingScore?.is_submitted && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">
              Submitted
            </Badge>
          )}
        </div>
        {ruleset && (
          <p className="mt-1 pl-11 text-[11px] text-muted-foreground truncate">
            Rules: {ruleset.name}
            {ruleset.version ? ` v${ruleset.version}` : ''}
          </p>
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
              <p className="text-muted-foreground">&quot;{participant.member.nickname}&quot;</p>
            )}
            {participant.member.country && (
              <p className="text-sm text-muted-foreground">{participant.member.country}</p>
            )}
          </div>
          <Badge variant="outline" className="rounded-full">#{participant.play_order || '?'}</Badge>
        </CardContent>
      </Card>

      {/* Technical Scores - large touch targets for eyes-free use */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base tracking-tight">
            Technical Execution
            {typeof ruleset?.scoring_config?.te_weight === 'number' && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({String(ruleset.scoring_config.te_weight)}%)
              </span>
            )}
          </CardTitle>
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
          <CardTitle className="text-base tracking-tight">
            Performance
            {typeof ruleset?.scoring_config?.fe_weight === 'number' && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({String(ruleset.scoring_config.fe_weight)}%)
              </span>
            )}
          </CardTitle>
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

      {/* Totals + actions docked above bottom nav */}
      <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur safe-area-bottom">
        <div className="mx-auto max-w-lg bg-primary/10 border-b border-primary/20 px-4 py-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Tech</p>
              <p className="text-lg font-bold font-mono tabular-nums">{totals.technical.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Perf</p>
              <p className="text-lg font-bold font-mono tabular-nums">{totals.performance.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Total</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-primary">{totals.total.toFixed(1)}</p>
            </div>
          </div>
        </div>
        <div className="p-3">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="secondary"
            className="flex-1 h-12 text-base rounded-full"
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
                className="flex-1 h-12 text-base rounded-full"
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
                  {existingScore?.is_submitted ? 'Overwrite Submitted Score?' : 'Confirm Submission'}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-muted-foreground text-sm text-left space-y-2">
                    {existingScore?.is_submitted ? (
                      <>
                        <span className="block">You are about to overwrite an existing submitted score for <strong className="text-foreground">{participant.member.full_name}</strong>. This will replace the previous submission.</span>
                        <span className="block text-amber-600 dark:text-amber-400 font-medium">Continue?</span>
                      </>
                    ) : (
                      <>
                        <span className="block">You are about to submit scores for:</span>
                        <span className="block font-semibold text-foreground">{participant.member.full_name}</span>
                      </>
                    )}
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
    </div>
  )
}
