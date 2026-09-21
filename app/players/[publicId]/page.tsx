/**
 * /players/[publicId] — public player profile (WCA-inspired, season-first).
 * Linked from RankingsClient rows and SearchDialog hits (/players/...).
 * Glob: no app/players/[publicId]/page.tsx yet
 * Reads via getPlayerProfile; no direct file IO. Dates: event_date, first_competed_on.
 * User: "There should also have a member profile page (reference WCA persons) do propose a better one if have any."
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlayerProfile } from '@/lib/rankings/profile'
import { getCountryFlag } from '@/lib/utils/country-flags'
import { formatLeagueId } from '@/lib/rankings/league-id'

interface PageProps {
  params: Promise<{ publicId: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { publicId } = await params
  try {
    const supabase = createAdminClient()
    const profile = await getPlayerProfile(supabase, publicId)
    if (!profile) return { title: 'Player | YoYo League' }
    const name = profile.nickname || profile.fullName
    return {
      title: `${name} | YoYo League`,
      description: `Season rankings and results for ${name}`,
    }
  } catch {
    return { title: 'Player | YoYo League' }
  }
}

export default async function PlayerPage({ params }: PageProps) {
  const { publicId } = await params
  const supabase = createAdminClient()
  let profile
  try {
    profile = await getPlayerProfile(supabase, publicId)
  } catch {
    notFound()
  }
  if (!profile) notFound()

  const display = profile.nickname || profile.fullName
  const flag = profile.isoAlpha2 ? getCountryFlag(profile.isoAlpha2) : ''

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/rankings" className="text-sm text-muted-foreground hover:text-foreground">
            ← Rankings
          </Link>
          {profile.publicId && (
            <span className="font-mono text-xs text-muted-foreground">
              League ID {formatLeagueId(profile.publicId)}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {flag ? `${flag} ` : ''}
            {display}
          </h1>
          {profile.nickname && profile.nickname !== profile.fullName && (
            <p className="text-muted-foreground">{profile.fullName}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {[
              profile.geoName || profile.country,
              profile.gender && profile.gender !== 'undisclosed' ? profile.gender : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {profile.bio && <p className="pt-2 text-sm leading-relaxed">{profile.bio}</p>}
          <div className="flex flex-wrap gap-4 pt-2 text-sm">
            <Stat label="Career points" value={profile.careerPoints.toLocaleString()} />
            <Stat label="Events scored" value={String(profile.eventsPlayed)} />
            {profile.firstCompetedOn && (
              <Stat
                label="First competed"
                value={new Date(profile.firstCompetedOn).getFullYear().toString()}
              />
            )}
          </div>
        </section>

        {profile.titles.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Titles
            </h2>
            <ul className="space-y-1 text-sm">
              {profile.titles.map((t, i) => (
                <li key={i}>
                  {t.seasonName} {t.categoryCode} — {t.titleKind.replace('_', ' ')} (#{t.rank})
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile.seasonRanks.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Season standings
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {profile.seasonRanks.map((r) => (
                <Link
                  key={`${r.seasonSlug}-${r.categoryCode}`}
                  href={`/rankings?season=${r.seasonSlug}&category=${r.categoryCode}`}
                  className="rounded-xl border p-4 hover:bg-muted/40"
                >
                  <p className="text-xs text-muted-foreground">
                    {r.seasonName} · {r.categoryCode}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {r.worldRank != null ? `#${r.worldRank}` : '—'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {r.totalPoints.toLocaleString()} pts world
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Results
          </h2>
          {profile.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No finalized season points yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {profile.results.map((r, i) => {
                const href = r.divisionId ? `/leaderboard/${r.divisionId}` : null
                return (
                  <li key={i}>
                    {href ? (
                      <Link
                        href={href}
                        className="flex items-start justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground underline-offset-4 hover:underline">
                            {r.eventName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[
                              r.eventDate,
                              r.categoryCode,
                              r.roundType.replace('_', ' '),
                              r.eligibility !== 'open' ? r.eligibility : null,
                              r.tierName,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {r.placement != null && (
                            <p className="text-xs text-muted-foreground">
                              Place {r.placement}
                              {r.fieldSize ? ` / ${r.fieldSize}` : ''}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">
                          +{r.points.toLocaleString()}
                        </span>
                      </Link>
                    ) : (
                      <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">{r.eventName}</p>
                          <p className="text-xs text-muted-foreground">
                            {[
                              r.eventDate,
                              r.categoryCode,
                              r.roundType.replace('_', ' '),
                              r.eligibility !== 'open' ? r.eligibility : null,
                              r.tierName,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {r.placement != null && (
                            <p className="text-xs text-muted-foreground">
                              Place {r.placement}
                              {r.fieldSize ? ` / ${r.fieldSize}` : ''}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">
                          +{r.points.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  )
}
