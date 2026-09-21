/**
 * Mid-routine rules reference for judges.
 * Called by: components/judge/ScoringForm.tsx (Rules button in sticky header).
 * Glob: no prior JudgeRules* under components/judge.
 * Reads props only (ruleset fields: name, code, version, source_url, rules_content, scoring_config).
 * User: "yes" (start judge in-app rules / scoring_type)
 */
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { BookOpen, ExternalLink } from 'lucide-react'
import type { Ruleset, ScoringType } from '@/lib/types/database'

type JudgeRuleset = Pick<
  Ruleset,
  'id' | 'name' | 'code' | 'version' | 'source_url' | 'rules_content' | 'scoring_config'
>

interface JudgeRulesSheetProps {
  ruleset: JudgeRuleset | null
  scoringType: ScoringType
  roundType?: string | null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function asRecord(value: unknown): Record<string, string | number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, string | number>
}

const scoringTypeLabels: Record<ScoringType, string> = {
  standard: 'Standard',
  clicker: 'Clicker',
  head_to_head: 'Head to Head',
}

export default function JudgeRulesSheet({
  ruleset,
  scoringType,
  roundType,
}: JudgeRulesSheetProps) {
  const config = ruleset?.scoring_config ?? {}
  const teWeight = Number(config.te_weight ?? 0)
  const feWeight = Number(config.fe_weight ?? 0)
  const isPrelim =
    roundType === 'wildcard' || roundType === 'qualifier' || roundType === 'semi_final'
  const feCategories = asStringArray(
    isPrelim ? config.fe_categories_prelim || config.fe_categories_final : config.fe_categories_final
  )
  const major = asRecord(config.major_deductions)
  const integrated = asRecord(config.integrated_deductions)

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-11 shrink-0 rounded-full"
          aria-label="Open scoring rules"
        >
          <BookOpen className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {ruleset?.name || 'Scoring rules'}
            {ruleset?.version && <Badge variant="outline">v{ruleset.version}</Badge>}
          </SheetTitle>
          <SheetDescription>
            {ruleset
              ? `${ruleset.code} · sheet mode: ${scoringTypeLabels[scoringType]}`
              : `No event ruleset attached · sheet mode: ${scoringTypeLabels[scoringType]}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5 pb-6">
          {scoringType === 'head_to_head' && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              This division is marked Head to Head. The live sheet is still the freestyle
              TE/FE clicker until a dedicated H2H UI ships.
            </div>
          )}

          {!ruleset && (
            <p className="text-sm text-muted-foreground">
              Ask the organizer to attach a ruleset on the event. You can still score with the
              standard TE/FE clicker sheet.
            </p>
          )}

          {ruleset && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Technical weight</p>
                  <p className="text-xl font-bold tabular-nums">{teWeight || '—'}%</p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">
                    {String(config.te_scoring || 'standard')}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Performance weight</p>
                  <p className="text-xl font-bold tabular-nums">{feWeight || '—'}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {feCategories.length} FE categories
                  </p>
                </div>
              </div>

              {feCategories.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">
                    FE categories{isPrelim ? ' (prelim / semi)' : ' (final)'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {feCategories.map((cat) => (
                      <Badge key={cat} variant="secondary" className="capitalize">
                        {cat.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Clicker fields map to the event sheet labels; use these categories as judging
                    guidance.
                  </p>
                </div>
              )}

              {major && Object.keys(major).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Major deductions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(major).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                        <Badge variant={value === 'DQ' ? 'destructive' : 'outline'}>
                          {String(value)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {integrated && Object.keys(integrated).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Integrated deductions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(integrated).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                        <Badge variant="outline">{String(value)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ruleset.source_url && (
                <a
                  href={ruleset.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Full rules source
                </a>
              )}

              {ruleset.rules_content && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Rules notes</h3>
                  <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed max-h-64 overflow-y-auto font-sans">
                    {ruleset.rules_content}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
