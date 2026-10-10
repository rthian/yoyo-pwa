export type CommsOutboxType =
  | 'payment_unpaid'
  | 'payment_pending_ack'
  | 'payment_pending_staff'
  | 'payment_rejected'
  | 'payment_approved'
  | 'payment_reminder'
  | 'event_countdown'
  | 'event_day'
  | 'organizer_blast'
  | 'results_published'
  | 'division_locked_digest'

export type CommsOutboxStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled'

export type BlastSegment =
  | 'all_registered'
  | 'unpaid'
  | 'waitlisted'
  | 'confirmed'
  | 'by_division'

export type NotificationPreferences = {
  account_id: string
  email_payment_reminders: boolean
  email_event_countdown: boolean
  email_organizer_blasts: boolean
  email_results_and_rankings: boolean
  email_staff_ops: boolean
  updated_at: string
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<
  NotificationPreferences,
  'account_id' | 'updated_at'
> = {
  email_payment_reminders: true,
  email_event_countdown: true,
  email_organizer_blasts: true,
  email_results_and_rankings: true,
  email_staff_ops: true,
}
