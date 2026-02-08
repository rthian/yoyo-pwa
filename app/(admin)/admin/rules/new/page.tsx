/**
 * Create New Ruleset Page
 * Admin form for creating a new competition ruleset
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import RulesetForm from '@/components/admin/RulesetForm'

export default function NewRulesetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Ruleset</h1>
        <p className="text-muted-foreground">
          Define a new competition ruleset with scoring configuration
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ruleset Details</CardTitle>
          <CardDescription>
            Configure the name, code, and scoring parameters for this ruleset
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RulesetForm />
        </CardContent>
      </Card>
    </div>
  )
}
