import type { CommsOutboxType } from '@/lib/comms/types'

export type TemplateContext = {
  eventName: string
  competitorName?: string | null
  hubUrl?: string | null
  feeLabel?: string | null
  reason?: string | null
  checklist?: string[]
  countdownLabel?: string | null
  customBody?: string | null
  subjectOverride?: string | null
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL?.replace(/^/, 'https://') ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

export function eventHubUrl(eventId: string) {
  return `${baseUrl()}/events/${eventId}`
}

export function registrationsUrl() {
  return `${baseUrl()}/member/registrations`
}

export function renderCommsTemplate(
  type: CommsOutboxType,
  ctx: TemplateContext
): { subject: string; body_text: string; body_html: string } {
  const name = ctx.competitorName || 'Competitor'
  const hub = ctx.hubUrl || ''
  const checklist =
    ctx.checklist && ctx.checklist.length
      ? '\nPrep checklist:\n' +
        ctx.checklist.map((c) => `• ${c}`).join('\n')
      : ''

  if (type === 'organizer_blast' && ctx.customBody) {
    const subject =
      ctx.subjectOverride || `Message from ${ctx.eventName}`
    const body_text = `${ctx.customBody}\n\n— ${ctx.eventName}${hub ? `\n${hub}` : ''}`
    return {
      subject,
      body_text,
      body_html: `<p>${ctx.customBody.replace(/\n/g, '<br/>')}</p><p>— ${ctx.eventName}</p>`,
    }
  }

  const map: Record<
    string,
    { subject: string; body: string }
  > = {
    payment_unpaid: {
      subject: `Payment needed — ${ctx.eventName}`,
      body: `Hi,\n\nRegistration for ${name} at ${ctx.eventName} still needs payment${ctx.feeLabel ? ` (${ctx.feeLabel})` : ''}.\nUpload a receipt: ${registrationsUrl()}\n${hub}`,
    },
    payment_pending_ack: {
      subject: `Receipt received — ${ctx.eventName}`,
      body: `Hi,\n\nWe received a payment receipt for ${name} at ${ctx.eventName}. Staff will review it shortly.\n${registrationsUrl()}`,
    },
    payment_pending_staff: {
      subject: `[Review] Payment receipt — ${ctx.eventName}`,
      body: `A registrant uploaded a payment receipt for ${ctx.eventName} (${name}).\nReview in Organize → Registrations.`,
    },
    payment_rejected: {
      subject: `Payment receipt rejected — ${ctx.eventName}`,
      body: `Hi,\n\nThe payment receipt for ${name} at ${ctx.eventName} was rejected.${ctx.reason ? `\nReason: ${ctx.reason}` : ''}\nPlease upload a new receipt: ${registrationsUrl()}`,
    },
    payment_approved: {
      subject: `Payment confirmed — ${ctx.eventName}`,
      body: `Hi,\n\nPayment for ${name} at ${ctx.eventName} is confirmed. See you at the event!\n${hub}`,
    },
    payment_reminder: {
      subject: `Reminder: pay for ${ctx.eventName}`,
      body: `Hi,\n\nFriendly reminder: registration for ${name} at ${ctx.eventName} is still unpaid${ctx.feeLabel ? ` (${ctx.feeLabel})` : ''}.\n${registrationsUrl()}\n${hub}`,
    },
    event_countdown: {
      subject: `${ctx.countdownLabel || 'Upcoming'} — ${ctx.eventName}`,
      body: `Hi,\n\n${ctx.eventName} is coming up (${ctx.countdownLabel || 'soon'}) for ${name}.${checklist}\nEvent hub: ${hub}\nRegistrations: ${registrationsUrl()}`,
    },
    event_day: {
      subject: `Today: ${ctx.eventName}`,
      body: `Hi,\n\nIt's event day for ${ctx.eventName} (${name}).${checklist}\nHub: ${hub}`,
    },
    results_published: {
      subject: `Results published — ${ctx.eventName}`,
      body: `Hi,\n\nOfficial results for ${ctx.eventName} are now published.\n${hub}`,
    },
    division_locked_digest: {
      subject: `Division locked — ${ctx.eventName}`,
      body: `Scoring was locked for a division at ${ctx.eventName}.\n${hub}`,
    },
    organizer_blast: {
      subject: ctx.subjectOverride || `Message — ${ctx.eventName}`,
      body: ctx.customBody || '',
    },
  }

  const t = map[type] || {
    subject: ctx.eventName,
    body: ctx.customBody || '',
  }
  return {
    subject: t.subject,
    body_text: t.body,
    body_html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${t.body}</pre>`,
  }
}
