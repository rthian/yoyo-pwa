/**
 * Admin Rules Library Page
 * Displays all rulesets with management actions
 */
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, BookOpen, ExternalLink, ChevronRight } from 'lucide-react'
import type { Ruleset } from '@/lib/types/database'

function getScoringBadge(config: Record<string, unknown>) {
  const teWeight = config.te_weight as number
  const feWeight = config.fe_weight as number
  if (teWeight && feWeight) {
    return `TE ${teWeight}% / FE ${feWeight}%`
  }
  return 'Custom'
}

function getRoundsBadges(config: Record<string, unknown>) {
  const rounds = config.rounds as string[] | undefined
  if (!rounds) return []
  return rounds.map((r: string) => r.replace(/_/g, ' '))
}

export default async function RulesPage() {
  const supabase = createAdminClient()

  const { data: rulesets, error } = await supabase
    .from('rulesets')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching rulesets:', error)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rules Library</h1>
          <p className="text-muted-foreground">
            Manage competition rulesets and scoring configurations
          </p>
        </div>
        <Link href="/admin/rules/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Ruleset
          </Button>
        </Link>
      </div>

      {rulesets && rulesets.length > 0 ? (
        <div className="grid gap-4">
          {(rulesets as Ruleset[]).map((ruleset) => (
            <Link key={ruleset.id} href={`/admin/rules/${ruleset.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{ruleset.name}</CardTitle>
                        {ruleset.version && (
                          <Badge variant="outline">v{ruleset.version}</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {ruleset.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {ruleset.code}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge>{getScoringBadge(ruleset.scoring_config)}</Badge>
                    {getRoundsBadges(ruleset.scoring_config).map((round: string) => (
                      <Badge key={round} variant="outline" className="capitalize text-xs">
                        {round}
                      </Badge>
                    ))}
                    {ruleset.source_url && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </div>
                    )}
                    <div className="flex-1" />
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No rulesets yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first ruleset to define competition scoring rules
            </p>
            <Link href="/admin/rules/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Ruleset
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
