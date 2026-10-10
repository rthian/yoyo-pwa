'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Prefs = {
  email_payment_reminders: boolean
  email_event_countdown: boolean
  email_organizer_blasts: boolean
  email_results_and_rankings: boolean
  email_staff_ops: boolean
}

const FIELDS: { key: keyof Prefs; label: string; hint: string }[] = [
  {
    key: 'email_payment_reminders',
    label: 'Payment reminders',
    hint: 'Unpaid registration and receipt status emails',
  },
  {
    key: 'email_event_countdown',
    label: 'Event countdown',
    hint: 'T-6 / T-3 / T-1 and event-day prep emails',
  },
  {
    key: 'email_organizer_blasts',
    label: 'Organizer messages',
    hint: 'Manual blasts from event staff',
  },
  {
    key: 'email_results_and_rankings',
    label: 'Results & rankings',
    hint: 'When official results are published',
  },
  {
    key: 'email_staff_ops',
    label: 'Staff ops alerts',
    hint: 'For organizers: receipt review and ops notices',
  },
]

export default function NotificationPreferencesForm() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/member/notification-preferences')
      if (!res.ok) return
      const data = await res.json()
      setPrefs(data.preferences)
    })()
  }, [])

  const save = async () => {
    if (!prefs) return
    setSaving(true)
    try {
      const res = await fetch('/api/member/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setPrefs(data.preferences)
      toast.success('Preferences saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!prefs) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {FIELDS.map((f) => (
        <div key={f.key} className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor={f.key}>{f.label}</Label>
            <p className="text-sm text-muted-foreground">{f.hint}</p>
          </div>
          <Switch
            id={f.key}
            checked={prefs[f.key]}
            onCheckedChange={(v) =>
              setPrefs((p) => (p ? { ...p, [f.key]: v } : p))
            }
          />
        </div>
      ))}
      <Button onClick={() => void save()} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving…
          </>
        ) : (
          'Save preferences'
        )}
      </Button>
    </div>
  )
}
