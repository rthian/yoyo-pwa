/**
 * Scoring Form — Worlds-aligned TE clicker + FE categories + majors after E.Total.
 * Callers: app/(judge)/judge/divisions/[id]/score/[participantId]/page.tsx
 * User: "yes" (align to WYYC sheet)
 */
'use client'

import { useState, useCallback, useMemo } from 'react'
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
import ScoreSlider from './ScoreSlider'
import JudgeRulesSheet from './JudgeRulesSheet'
import TeClickerScreen from './TeClickerScreen'
import { generateClientId, saveOfflineScore } from '@/lib/offline/queue'
import {
  hydrateTeFromExClicks,
  hydrateMajors,
  majorPoints,
  teNet,
  type MajorDeductionState,
  type TeClickerState,
} from '@/lib/judge/te-clicker'
import {
  FE_FIELD_MAP,
  FE_LABELS,
  computeScores,
  majorsAreSeparate,
  type ScoringConfigLike,
} from '@/lib/judge/score-math'
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
  nextParticipant?: {
    id: string
    fullName: string
    playOrder: number | null
  } | null
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

type ScoreKey =
  | 'ex_clicks'
  | 'ex_pv'
  | 'ex_ch'
  | 'ex_cons'
  | 'ex_space'
  | 'ex_body'
  | 'ex_showman'
  | 'ex_music'
  | 'ex_construct'
  | 'ex_trick_div'
  | 'ex_deductions'

type ScoringStep = 'te' | 'evaluation'

export default function ScoringForm({
  division,
  participant,
  existingScore,
  judgeId,
  nextParticipant = null,
}: ScoringFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<ScoringStep>('te')

  const event = Array.isArray(division.event) ? division.event[0] : division.event
  const ruleset = oneRuleset(event?.ruleset)
  const scoringConfig = (ruleset?.scoring_config ?? null) as ScoringConfigLike | null
  const scoringType = (division.scoring_type || 'standard') as ScoringType
  const separateMajors = majorsAreSeparate(scoringConfig)
  const majorMode = separateMajors ? 'separate' : 'integrated'

  const [scores, setScores] = useState<Record<ScoreKey, number>>(() => ({
    ex_clicks: existingScore?.ex_clicks ?? 0,
    ex_pv: existingScore?.ex_pv ?? 0,
    ex_ch: existingScore?.ex_ch ?? 0,
    ex_cons: existingScore?.ex_cons ?? 0,
    ex_space: existingScore?.ex_space ?? 0,
    ex_body: existingScore?.ex_body ?? 0,
    ex_showman: existingScore?.ex_showman ?? 0,
    ex_music: existingScore?.ex_music ?? 0,
    ex_construct: existingScore?.ex_construct ?? 0,
    ex_trick_div: existingScore?.ex_trick_div ?? 0,
    ex_deductions: existingScore?.ex_deductions ?? 0,
  }))

  const [teState, setTeState] = useState<TeClickerState>(() =>
    hydrateTeFromExClicks(existingScore?.ex_clicks)
  )
  const [majors, setMajors] = useState<MajorDeductionState>(() =>
    hydrateMajors({
      md_stop_count: existingScore?.md_stop_count,
      md_discard_count: existingScore?.md_discard_count,
      md_detach_count: existingScore?.md_detach_count,
    })
  )

  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleTeChange = useCallback((next: TeClickerState) => {
    setTeState(next)
    setScores((prev) => ({ ...prev, ex_clicks: teNet(next) }))
  }, [])

  const handleMajorsChange = useCallback((next: MajorDeductionState) => {
    setMajors(next)
    setScores((prev) => ({
      ...prev,
      ex_deductions: majorPoints(next),
    }))
  }, [])

  const scoreFieldsForMath = useMemo(
    () => ({
      ...scores,
      ex_clicks: teNet(teState),
      md_stop_count: majors.stopCount,
      md_discard_count: majors.discardCount,
      md_detach_count: majors.detachCount,
      ex_deductions: majorPoints(majors),
    }),
    [scores, teState, majors]
  )

  const computed = useMemo(
    () =>
      computeScores(scoreFieldsForMath, scoringConfig, division.round_type ?? 'final'),
    [scoreFieldsForMath, scoringConfig, division.round_type]
  )

  const feKeys = computed.feCategoryKeys

  const handleScoreChange = (key: ScoreKey, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }))
    if (key === 'ex_clicks') {
      setTeState(hydrateTeFromExClicks(value))
    }
  }

  const payloadScores = () => ({
    ...scores,
    ex_clicks: teNet(teState),
    ex_deductions: majorPoints(majors),
    md_stop_count: majors.stopCount,
    md_discard_count: majors.discardCount,
    md_detach_count: majors.detachCount,
  })

  const saveOffline = async () => {
    await saveOfflineScore({
      clientId: generateClientId(),
      divisionId: division.id,
      divisionMemberId: participant.id,
      judgeId,
      scoreData: payloadScores(),
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
        ...payloadScores(),
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
        if (nextParticipant) {
          router.push(`/judge/divisions/${division.id}/score/${nextParticipant.id}`)
        } else {
          router.push(`/judge/divisions/${division.id}`)
        }
      }

      router.refresh()
    } catch (error) {
      const offline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        error instanceof TypeError
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

  const teWeight = typeof scoringConfig?.te_weight === 'number' ? scoringConfig.te_weight : 60
  const feWeight = typeof scoringConfig?.fe_weight === 'number' ? scoringConfig.fe_weight : 40

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
              {step === 'te' ? ' · Live TE' : ' · FE Evaluation'}
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

      {step === 'te' ? (
        <TeClickerScreen
          state={teState}
          majors={majors}
          majorMode={majorMode}
          onTeChange={handleTeChange}
          onMajorsChange={handleMajorsChange}
          onContinueToEvaluation={() => setStep('evaluation')}
        />
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg">{participant.member.full_name}</p>
                {participant.member.nickname && (
                  <p className="text-muted-foreground">
                    &quot;{participant.member.nickname}&quot;
                  </p>
                )}
              </div>
              <Badge variant="outline" className="rounded-full">
                #{participant.play_order || '?'}
              </Badge>
            </CardContent>
          </Card>

          {nextParticipant && (
            <p className="text-xs text-muted-foreground px-1">
              After submit → #{nextParticipant.playOrder ?? '?'} {nextParticipant.fullName}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-full"
            onClick={() => setStep('te')}
          >
            Back to live TE
          </Button>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base tracking-tight">
                Freestyle Evaluation (FE)
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  → /{feWeight}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {feKeys.map((key) => {
                const col = FE_FIELD_MAP[key] as ScoreKey | undefined
                if (!col || col === 'ex_clicks' || col === 'ex_deductions') return null
                return (
                  <ScoreSlider
                    key={key}
                    label={FE_LABELS[key] ?? key}
                    value={scores[col]}
                    onChange={(v) => handleScoreChange(col, v)}
                    min={0}
                    max={10}
                    step={0.5}
                  />
                )
              })}
            </CardContent>
          </Card>

          {separateMajors && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-destructive tracking-tight">
                  Major Deductions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ClickerInput
                  label="Stop (−1 each)"
                  value={majors.stopCount}
                  onChange={(v) =>
                    handleMajorsChange({ ...majors, stopCount: Math.max(0, Math.trunc(v)) })
                  }
                  min={0}
                  max={99}
                  step={1}
                  isInteger
                  variant="destructive"
                />
                <ClickerInput
                  label="Discard (−3 each)"
                  value={majors.discardCount}
                  onChange={(v) =>
                    handleMajorsChange({
                      ...majors,
                      discardCount: Math.max(0, Math.trunc(v)),
                    })
                  }
                  min={0}
                  max={99}
                  step={1}
                  isInteger
                  variant="destructive"
                />
                <ClickerInput
                  label="Cut / Detach (−5 each)"
                  value={majors.detachCount}
                  onChange={(v) =>
                    handleMajorsChange({
                      ...majors,
                      detachCount: Math.max(0, Math.trunc(v)),
                    })
                  }
                  min={0}
                  max={99}
                  step={1}
                  isInteger
                  variant="destructive"
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur safe-area-bottom">
        <div className="mx-auto max-w-lg bg-primary/10 border-b border-primary/20 px-4 py-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                TE/{teWeight}
              </p>
              <p className="text-lg font-bold font-mono tabular-nums">
                {computed.technical.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                FE/{feWeight}
              </p>
              <p className="text-lg font-bold font-mono tabular-nums">
                {computed.performance.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                E.Total
              </p>
              <p className="text-lg font-bold font-mono tabular-nums">
                {computed.eTotal.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                Final
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-primary">
                {computed.total.toFixed(1)}
              </p>
            </div>
          </div>
          {computed.majorPoints > 0 && (
            <p className="mt-1 text-center text-[10px] text-destructive">
              Majors −{computed.majorPoints}
            </p>
          )}
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
                    {existingScore?.is_submitted
                      ? 'Overwrite Submitted Score?'
                      : 'Confirm Submission'}
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="text-muted-foreground text-sm text-left space-y-2">
                      <span className="block font-semibold text-foreground">
                        {participant.member.full_name}
                      </span>
                      <div className="mt-3 p-3 bg-muted rounded-lg space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>TE /{teWeight}</span>
                          <span className="font-medium">{computed.technical.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>FE /{feWeight}</span>
                          <span className="font-medium">{computed.performance.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>E.Total</span>
                          <span className="font-medium">{computed.eTotal.toFixed(1)}</span>
                        </div>
                        {computed.majorPoints > 0 && (
                          <div className="flex justify-between text-destructive">
                            <span>Majors</span>
                            <span className="font-medium">−{computed.majorPoints}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                          <span>Final</span>
                          <span className="text-primary">{computed.total.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row gap-2">
                  <AlertDialogCancel className="flex-1 m-0">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="flex-1 m-0" onClick={() => saveScore(true)}>
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
