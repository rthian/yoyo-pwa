/**
 * Ruleset Detail Page
 * View and manage a specific ruleset
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, ExternalLink, BookOpen } from 'lucide-react'
import type { Ruleset } from '@/lib/types/database'
import RulesetDeleteButton from '@/components/admin/RulesetDeleteButton'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function RulesetDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: ruleset, error } = await supabase
    .from('rulesets')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !ruleset) {
    notFound()
  }

  const typedRuleset = ruleset as Ruleset
  const config = typedRuleset.scoring_config

  // Check if any events use this ruleset
  const { data: eventsUsing } = await supabase
    .from('events')
    .select('id, name')
    .eq('ruleset_id', id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/rules">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{typedRuleset.name}</h1>
            {typedRuleset.version && (
              <Badge variant="outline">v{typedRuleset.version}</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            <span className="font-mono text-xs">{typedRuleset.code}</span>
            {typedRuleset.description && ` — ${typedRuleset.description}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/rules/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <RulesetDeleteButton rulesetId={id} rulesetName={typedRuleset.name} />
        </div>
      </div>

      {/* Scoring Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Technical Execution</CardDescription>
            <CardTitle className="text-2xl">
              {(config.te_weight as number) || 0}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground capitalize">
              {String(config.te_scoring || 'standard')} scoring
              {Boolean(config.te_normalization) && ' with normalization'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Freestyle Evaluation</CardDescription>
            <CardTitle className="text-2xl">
              {(config.fe_weight as number) || 0}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {((config.fe_categories_final as string[]) || []).length} categories (Final)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rounds</CardDescription>
            <CardTitle className="text-2xl">
              {((config.rounds as string[]) || []).length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 flex-wrap">
              {((config.rounds as string[]) || []).map((r: string) => (
                <Badge key={r} variant="outline" className="text-xs capitalize">
                  {r.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FE Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Freestyle Evaluation Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium mb-2">Final Round</h4>
              <div className="flex flex-wrap gap-2">
                {((config.fe_categories_final as string[]) || []).map((cat: string) => (
                  <Badge key={cat} className="capitalize">
                    {cat.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Prelim / Semi-Final</h4>
              <div className="flex flex-wrap gap-2">
                {((config.fe_categories_prelim as string[]) || []).map((cat: string) => (
                  <Badge key={cat} variant="secondary" className="capitalize">
                    {cat.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deductions */}
      {Boolean(config.major_deductions) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Major Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
              {Object.entries(config.major_deductions as Record<string, number | string>).map(
                ([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                    <Badge variant={value === 'DQ' ? 'destructive' : 'secondary'}>
                      {String(value)}
                    </Badge>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {Boolean(config.integrated_deductions) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Integrated Deductions (TE Clicks)</CardTitle>
            <CardDescription>
              Deductions are handled through negative TE clicks instead of a separate system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
              {Object.entries(config.integrated_deductions as Record<string, number>).map(
                ([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                    <Badge variant="secondary">{String(value)}</Badge>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source & Metadata */}
      {typedRuleset.source_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Source</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={typedRuleset.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              {typedRuleset.source_url}
            </a>
          </CardContent>
        </Card>
      )}

      {/* Events Using This Ruleset */}
      {eventsUsing && eventsUsing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Events Using This Ruleset</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {eventsUsing.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                >
                  <BookOpen className="h-4 w-4" />
                  {event.name}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Full Scoring Configuration</CardTitle>
          <CardDescription>Raw JSON configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto font-mono">
            {JSON.stringify(config, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
