/**
 * Public event hub — Register / Schedule / Boards.
 * Next.js route for /events/[id]. Renders EventHubClient.
 * Glob: only schedule/ existed under events/[id]; no page.tsx yet.
 * User: "yes" (start event hub)
 */
import { Suspense } from 'react'
import EventHubClient from '@/components/events/EventHubClient'
import { Loader2 } from 'lucide-react'

export default async function EventHubPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <EventHubClient eventId={id} />
    </Suspense>
  )
}
