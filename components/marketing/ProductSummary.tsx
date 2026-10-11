import Link from 'next/link'

const personas = [
  {
    title: 'Organizers & staff',
    items: [
      'Publish and run events with capability-scoped /organize panels',
      'Registration, waitlist, receipts, music, schedule, and advancement',
      'Publish official results, then finalize season ranking points',
    ],
  },
  {
    title: 'Judges',
    items: [
      'Mobile TE/FE clicker scoring with drafts and overwrite confirm',
      'Offline queue that syncs when the venue network returns',
      'Head-judge lock and panel visualiser for consistency checks',
    ],
  },
  {
    title: 'Competitors & guardians',
    items: [
      'Register for divisions and upload required music',
      'Manage self or linked competitors from one account',
      'Follow live boards and season standing',
    ],
  },
  {
    title: 'Fans',
    items: [
      'Open shareable live leaderboards without signing in',
      'Browse season rankings and player profiles',
      'Read how ranking points work',
    ],
  },
] as const

const journey = [
  'Publish the event and open registration',
  'Confirm entries, music, and check-in',
  'Judges score (online or offline)',
  'Lock divisions and publish official results',
  'Finalize to write season ranking points',
] as const

const nextUp = [
  'Card payments (Stripe) — today: QR + receipt verification',
  'Dedicated head-to-head scoring UI',
  'Guardian invites and fuller waiver workflow',
  'In-app notification center and PWA push',
] as const

export default function ProductSummary() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-sm font-medium tracking-wide text-primary">Product</p>
      <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        What YoYo League is today
      </h1>
      <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
        A Progressive Web App for competitive yo-yo: event ops, floor judging, live boards,
        published results, and season rankings — in one product with role-aware surfaces.
      </p>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Who it’s for</h2>
        <div className="mt-8 space-y-10">
          {personas.map(({ title, items }) => (
            <div key={title}>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                {items.map((item) => (
                  <li key={item} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          How an event runs
        </h2>
        <ol className="mt-6 space-y-3">
          {journey.map((step, i) => (
            <li key={step} className="flex gap-4 text-muted-foreground">
              <span className="w-8 shrink-0 font-medium text-primary">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">What’s next</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Honest backlog — these are not shipped yet:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
          {nextUp.map((item) => (
            <li key={item} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 rounded-2xl bg-muted px-6 py-8">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Try it</h2>
        <p className="mt-2 text-muted-foreground">
          Create an account, open public boards, or read how season points work.
        </p>
        <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
          <li>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
            >
              Create account
            </Link>
          </li>
          <li>
            <Link
              href="/leaderboards"
              className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
            >
              Live boards
            </Link>
          </li>
          <li>
            <Link
              href="/rankings/how-it-works"
              className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
            >
              How rankings work
            </Link>
          </li>
        </ul>
      </section>
    </article>
  )
}
