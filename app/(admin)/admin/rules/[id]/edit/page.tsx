/**
 * Edit Ruleset Page
 * Admin form for editing an existing competition ruleset
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import RulesetForm from '@/components/admin/RulesetForm'
import type { Ruleset } from '@/lib/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditRulesetPage({ params }: PageProps) {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Ruleset</h1>
        <p className="text-muted-foreground">
          Update the ruleset configuration for {(ruleset as Ruleset).name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ruleset Details</CardTitle>
          <CardDescription>
            Update the name, description, and scoring parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RulesetForm ruleset={ruleset as Ruleset} />
        </CardContent>
      </Card>
    </div>
  )
}
