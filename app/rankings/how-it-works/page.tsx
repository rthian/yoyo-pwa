/**
 * /rankings/how-it-works — season points, race boards, tiers, Custom Leagues.
 * Linked from rankings header Info. Reads seasons, event_tiers, points_table_rows.
 */
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = {
  title: 'How Rankings Work | YoYo League',
  description:
    'World Race, National Race, Custom Leagues, event tiers, and season points explained',
}

type TierRow = {
  name: string
  code: string
  multiplier: number
  counts_for_world_race: boolean | null
  counts_for_national_race: boolean | null
}

/** Shown when DB tiers are missing or pre-migration 007/008. */
const FALLBACK_TIERS: TierRow[] = [
  {
    code: 'LOCAL',
    name: 'Local / Club',
    multiplier: 0.5,
    counts_for_world_race: false,
    counts_for_national_race: false,
  },
  {
    code: 'STATE',
    name: 'State',
    multiplier: 1,
    counts_for_world_race: false,
    counts_for_national_race: false,
  },
  {
    code: 'REGIONAL',
    name: 'Regional',
    multiplier: 2,
    counts_for_world_race: false,
    counts_for_national_race: true,
  },
  {
    code: 'NATIONAL',
    name: 'National',
    multiplier: 3,
    counts_for_world_race: true,
    counts_for_national_race: true,
  },
  {
    code: 'CONTINENTAL',
    name: 'Continental (AP / EYYC)',
    multiplier: 4,
    counts_for_world_race: true,
    counts_for_national_race: false,
  },
  {
    code: 'WORLD',
    name: 'World',
    multiplier: 5,
    counts_for_world_race: true,
    counts_for_national_race: false,
  },
]

function raceLabel(t: TierRow): string {
  const parts: string[] = []
  if (t.counts_for_national_race) parts.push('National')
  if (t.counts_for_world_race) parts.push('World')
  if (!parts.length) return 'Custom League only'
  return parts.join(' + ') + ' Race'
}

export default async function HowItWorksPage() {
  let seasons: {
    name: string
    slug: string
    counting_results: number | null
    starts_on: string
    ends_on: string
    is_active: boolean
  }[] = []
  let tiers: TierRow[] = []
  let rows: {
    round_type: string
    placement_from: number
    placement_to: number
    points: number
  }[] = []
  let loadError: string | null = null
  let usingFallbackTiers = false

  try {
    const supabase = createAdminClient()
    const [s, t, pt] = await Promise.all([
      supabase
        .from('seasons')
        .select('name, slug, counting_results, starts_on, ends_on, is_active')
        .order('starts_on', { ascending: false }),
      supabase
        .from('event_tiers')
        .select('name, code, multiplier, counts_for_world_race, counts_for_national_race')
        .order('sort_order'),
      supabase.from('points_tables').select('id, code').eq('code', 'DEFAULT_V1').maybeSingle(),
    ])
    seasons = s.data ?? []
    if (t.error) {
      // Column missing until migrations 007–008
      const legacy = await supabase
        .from('event_tiers')
        .select('name, code, multiplier')
        .order('sort_order')
      tiers = (legacy.data ?? []).map((row) => {
        const fb = FALLBACK_TIERS.find((f) => f.code === row.code)
        return {
          name: row.name,
          code: row.code,
          multiplier: Number(row.multiplier),
          counts_for_world_race: fb?.counts_for_world_race ?? null,
          counts_for_national_race: fb?.counts_for_national_race ?? null,
        }
      })
      if (!tiers.length) {
        tiers = FALLBACK_TIERS
        usingFallbackTiers = true
      } else if (tiers.some((x) => x.counts_for_world_race == null)) {
        usingFallbackTiers = true
        tiers = tiers.map((row) => {
          const fb = FALLBACK_TIERS.find((f) => f.code === row.code)
          return fb
            ? {
                ...row,
                name: fb.name,
                multiplier: fb.multiplier,
                counts_for_world_race: fb.counts_for_world_race,
                counts_for_national_race: fb.counts_for_national_race,
              }
            : row
        })
        // Ensure CONTINENTAL present
        if (!tiers.some((x) => x.code === 'CONTINENTAL')) {
          const cont = FALLBACK_TIERS.find((f) => f.code === 'CONTINENTAL')!
          tiers = [...tiers, cont].sort(
            (a, b) =>
              FALLBACK_TIERS.findIndex((f) => f.code === a.code) -
              FALLBACK_TIERS.findIndex((f) => f.code === b.code)
          )
        }
      }
    } else {
      tiers = (t.data ?? []).map((row) => ({
        name: row.name,
        code: row.code,
        multiplier: Number(row.multiplier),
        counts_for_world_race: row.counts_for_world_race ?? null,
        counts_for_national_race: row.counts_for_national_race ?? null,
      }))
      if (!tiers.length) {
        tiers = FALLBACK_TIERS
        usingFallbackTiers = true
      }
    }
    if (pt.data?.id) {
      const pr = await supabase
        .from('points_table_rows')
        .select('round_type, placement_from, placement_to, points')
        .eq('points_table_id', pt.data.id)
        .order('round_type')
        .order('placement_from')
      rows = pr.data ?? []
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Could not load live tables'
    tiers = FALLBACK_TIERS
    usingFallbackTiers = true
  }

  const active = seasons.find((x) => x.is_active) || seasons[0]
  const bestN = active?.counting_results ?? 6

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/rankings" className="text-sm text-muted-foreground hover:text-foreground">
            ← Rankings
          </Link>
        </div>
      </header>

      <main className="prose prose-zinc mx-auto max-w-3xl space-y-10 px-4 py-10 dark:prose-invert">
        <div>
          <p className="not-prose text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            YoYo League
          </p>
          <h1 className="mb-2 mt-1">How rankings work</h1>
          <p className="lead text-muted-foreground">
            One placement ledger, several season boards — World Race, National Race, and
            admin-run Custom Leagues. Closer to an ATP Race than DUPR or WCA personal bests.
          </p>
        </div>

        {(loadError || usingFallbackTiers) && (
          <p className="not-prose rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {loadError
              ? `Live tables unavailable (${loadError}). `
              : null}
            Showing the current design rules
            {usingFallbackTiers ? ' (apply migrations 007–008 for live tier flags)' : ''}.
          </p>
        )}

        <section>
          <h2>Three kinds of boards</h2>
          <div className="not-prose overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2">Board</th>
                  <th className="px-3 py-2">What counts</th>
                  <th className="px-3 py-2">Title</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">World Race</td>
                  <td className="px-3 py-2">
                    National + Continental (AP / EYYC) + World. Not regionals, state, or
                    local.
                  </td>
                  <td className="px-3 py-2">Season world #1 (per style)</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">National Race</td>
                  <td className="px-3 py-2">
                    Regional + National — the country pathway (regionals feed nationals).
                  </td>
                  <td className="px-3 py-2">Season national / geo #1</td>
                </tr>
                <tr className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">Custom League</td>
                  <td className="px-3 py-2">
                    Whatever contests an admin includes (can include local/state). Own
                    best‑N.
                  </td>
                  <td className="px-3 py-2">League title — not World Champion</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Same finalized points feed every board. Filters decide which events appear on
            which race.
          </p>
        </section>

        <section>
          <h2>Seasons that reset</h2>
          <p>
            Boards are <strong>season championships</strong>
            {active ? (
              <>
                {' '}
                (currently <strong>{active.name}</strong>, {active.starts_on} →{' '}
                {active.ends_on})
              </>
            ) : null}
            . Only your <strong>best {bestN}</strong> counting results per category count
            toward a season total. Points reset when a new season starts — like F1 or the
            ATP Race to Turin.
          </p>
          <p>
            Career history stays on each player profile. Privileges for past champions are
            access and seeding, not carried points.
          </p>
        </section>

        <section>
          <h2>How you earn points</h2>
          <ol>
            <li>Compete in a division with a play category (1A–5A or AP).</li>
            <li>When scoring is locked, standings are frozen.</li>
            <li>
              Admins finalize the event — you get <strong>one award per category</strong>{' '}
              from the deepest round you reached and your placement there (not a sum of
              every round).
            </li>
            <li>
              Event <strong>tier multiplier</strong> scales those base points. Which races
              that event enters depends on the tier (table below).
            </li>
          </ol>
          <p>
            Reaching a final always beats winning a qualifier. Participation still earns a
            floor so showing up matters.
          </p>
        </section>

        <section>
          <h2>Event tiers</h2>
          <p>
            Hierarchy: Regional ×2 → National ×3 → Continental ×4 → World ×5. Local and
            State stay available for Custom Leagues only.
          </p>
          <div className="not-prose overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Multiplier</th>
                  <th className="px-3 py-2">Counts toward</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.code} className="border-b last:border-0">
                    <td className="px-3 py-2">{t.name}</td>
                    <td className="px-3 py-2 tabular-nums">×{t.multiplier}</td>
                    <td className="px-3 py-2">{raceLabel(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {rows.length > 0 && (
          <section>
            <h2>Default points table</h2>
            <p>Base points before the tier multiplier (deepest round only).</p>
            <div className="not-prose overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2">Round</th>
                    <th className="px-3 py-2">Place</th>
                    <th className="px-3 py-2">Base pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2 capitalize">
                        {r.round_type.replace('_', ' ')}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {r.placement_from === r.placement_to
                          ? r.placement_from
                          : r.placement_to >= 9999
                            ? `${r.placement_from}+`
                            : `${r.placement_from}–${r.placement_to}`}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{Number(r.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              Example: Worlds Final #1 = 250 × 5 = <strong>1,250</strong> season points.
              Continental Final #1 = 250 × 4 = <strong>1,000</strong>.
            </p>
          </section>
        )}

        <section>
          <h2>Championship vs invitational</h2>
          <p>
            At a National (and similar events), organizers can split fields:
          </p>
          <ul>
            <li>
              <strong>Championship</strong> — citizens / residents racing for the national
              title. Counts toward <em>National Race</em> and <em>World Race</em> (when the
              event tier allows).
            </li>
            <li>
              <strong>Invitational / International Open</strong> — invite or visiting
              players. Counts toward <em>World Race</em> (and Custom Leagues) but{' '}
              <strong>not</strong> National Race or the host national title.
            </li>
          </ul>
          <p>
            Same idea as IYYF: National Contests are for citizens and residents;
            non-championship International Open divisions are separate.
          </p>
        </section>

        <section>
          <h2>Custom Leagues</h2>
          <p>
            A <strong>Custom League</strong> is an admin-curated participation race
            (placeholder name). Organizers choose exactly which contests count, set a
            best‑N cap, and publish a separate board and trophy. Examples: SEA Circuit, JP
            League, International Open Cup. It never replaces World Race or National Race.
          </p>
          <p>
            Manage include lists in Admin → Custom Leagues. On Rankings, switch the board
            dropdown from World Race to a Custom League when one exists.
          </p>
        </section>

        <section>
          <h2>Open vs Women</h2>
          <p>
            Gender is on the player profile (optional, self-declared). The{' '}
            <strong>Women</strong> filter shows female competitors on the same points
            ledger — like FIDE women’s lists — so a top woman can appear in both Open and
            Women.
          </p>
        </section>

        <section>
          <h2>Region filters</h2>
          <p>
            Rankings use your <strong>home region</strong> (world → region → country →
            state), not where the event was held — same convention as WCA / FIP. Use this
            to view a country or continent slice of a race.
          </p>
        </section>

        <section>
          <h2>Privileges for past champions</h2>
          <p>
            When a season ends, top finishers can earn <em>access and order</em> benefits
            for the next season — title badge, seeding (later run order), guaranteed entry
            if caps apply. They do <strong>not</strong> carry points into the new season;
            that would make the reset fake.
          </p>
        </section>

        <p className="not-prose flex flex-wrap gap-3">
          <Link
            href="/rankings"
            className="inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            View current rankings
          </Link>
          <Link
            href="/rankings"
            className="inline-flex rounded-md border px-4 py-2 text-sm font-medium"
          >
            Back to filters
          </Link>
        </p>
      </main>
    </div>
  )
}
