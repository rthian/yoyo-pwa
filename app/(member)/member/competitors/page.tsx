/**
 * Prompt 17: member managed competitors.
 * Callers: MemberHeader nav → /member/competitors
 * Glob: no prior competitors page
 * Sample: ManagedCompetitorsPanel lists self + guardian links
 * User: "Start build"
 */
import ManagedCompetitorsPanel from '@/components/member/ManagedCompetitorsPanel'

export default function MemberCompetitorsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Competitors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your competition identity and people you manage (e.g. children). Use
          Events to register them and Music when you have upload permission.
        </p>
      </div>
      <ManagedCompetitorsPanel />
    </div>
  )
}
