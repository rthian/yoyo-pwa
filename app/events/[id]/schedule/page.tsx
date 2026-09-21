/**
 * Legacy schedule URL → event hub Schedule tab.
 * Next route for /events/[id]/schedule. Redirects to /events/[id]?tab=schedule.
 * Hub: app/events/[id]/page.tsx. Replaces prior full schedule UI in this file.
 * User: "yes" (start event hub)
 */
import { redirect } from 'next/navigation'

export default async function PublicScheduleRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/events/${id}?tab=schedule`)
}
