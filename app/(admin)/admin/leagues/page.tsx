/**
 * Admin Custom Leagues — curated contest sets (participation race placeholder).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import CustomLeaguesPanel from '@/components/admin/CustomLeaguesPanel'

export const metadata = {
  title: 'Custom Leagues | Admin',
  description: 'Create Custom Leagues and choose which contests count',
}

export default async function AdminLeaguesPage() {
  const supabase = createAdminClient()
  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date, season_id')
    .order('event_date', { ascending: false })

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Custom Leagues</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Placeholder name for curated participation races. Admins choose which contests
          count. Separate from World Race and National Race — own standings and title.
        </p>
      </div>
      <CustomLeaguesPanel
        initialEvents={(events ?? []).map((e) => ({
          id: e.id,
          name: e.name,
          event_date: e.event_date,
          season_id: e.season_id,
        }))}
      />
    </div>
  )
}
