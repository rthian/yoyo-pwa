/**
 * Email delivery for comms outbox.
 * Uses Resend when RESEND_API_KEY is set; otherwise logs and marks sent (dev).
 */

export type SendEmailInput = {
  to: string
  subject: string
  text: string
  html?: string | null
}

export type SendEmailResult = { ok: true; provider: string; id?: string } | {
  ok: false
  provider: string
  error: string
}

export async function sendCommsEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from =
    process.env.COMMS_FROM_EMAIL || 'YoYo League <onboarding@resend.dev>'

  if (!apiKey) {
    console.info('[comms:email:dev]', {
      to: input.to,
      subject: input.subject,
      text: input.text.slice(0, 200),
    })
    return { ok: true, provider: 'console', id: `dev-${Date.now()}` }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html || undefined,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      id?: string
      message?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        provider: 'resend',
        error: json.message || `Resend HTTP ${res.status}`,
      }
    }
    return { ok: true, provider: 'resend', id: json.id }
  } catch (e) {
    return {
      ok: false,
      provider: 'resend',
      error: e instanceof Error ? e.message : 'Send failed',
    }
  }
}
