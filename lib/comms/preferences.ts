import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/comms/types'

export async function getNotificationPreferences(
  supabase: SupabaseClient,
  accountId: string
): Promise<NotificationPreferences> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()

  if (data) return data as NotificationPreferences

  return {
    account_id: accountId,
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    updated_at: new Date().toISOString(),
  }
}

export async function upsertNotificationPreferences(
  supabase: SupabaseClient,
  accountId: string,
  patch: Partial<typeof DEFAULT_NOTIFICATION_PREFERENCES>
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(supabase, accountId)
  const row = {
    account_id: accountId,
    email_payment_reminders:
      patch.email_payment_reminders ?? current.email_payment_reminders,
    email_event_countdown:
      patch.email_event_countdown ?? current.email_event_countdown,
    email_organizer_blasts:
      patch.email_organizer_blasts ?? current.email_organizer_blasts,
    email_results_and_rankings:
      patch.email_results_and_rankings ?? current.email_results_and_rankings,
    email_staff_ops: patch.email_staff_ops ?? current.email_staff_ops,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(row)
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message || 'Failed to save preferences')
  return data as NotificationPreferences
}

export function prefAllows(
  prefs: NotificationPreferences,
  kind:
    | 'payment'
    | 'countdown'
    | 'blast'
    | 'results'
    | 'staff'
): boolean {
  switch (kind) {
    case 'payment':
      return prefs.email_payment_reminders
    case 'countdown':
      return prefs.email_event_countdown
    case 'blast':
      return prefs.email_organizer_blasts
    case 'results':
      return prefs.email_results_and_rankings
    case 'staff':
      return prefs.email_staff_ops
  }
}
