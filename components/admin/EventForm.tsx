/**
 * Event Form Component
 * Handles create and edit for events including timing windows.
 */
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { eventSchema, type EventFormData } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Event, Ruleset } from '@/lib/types/database'
import type { EventTier, GeoNode, Season } from '@/lib/rankings/types'
import {
  COMMON_TIMEZONES,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/lib/events/timing'

interface EventFormProps {
  event?: Event
}

type LocalTimingState = {
  starts_at: string
  ends_at: string
  registration_opens_at: string
  registration_closes_at: string
  music_deadline_at: string
  check_in_opens_at: string
  check_in_closes_at: string
}

export default function EventForm({ event }: EventFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [rulesets, setRulesets] = useState<Ruleset[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [tiers, setTiers] = useState<EventTier[]>([])
  const [countries, setCountries] = useState<GeoNode[]>([])
  const [timezone, setTimezone] = useState(event?.timezone || 'UTC')
  const [localTiming, setLocalTiming] = useState<LocalTimingState>(() => ({
    starts_at: toDatetimeLocalValue(event?.starts_at, event?.timezone || 'UTC'),
    ends_at: toDatetimeLocalValue(event?.ends_at, event?.timezone || 'UTC'),
    registration_opens_at: toDatetimeLocalValue(
      event?.registration_opens_at,
      event?.timezone || 'UTC'
    ),
    registration_closes_at: toDatetimeLocalValue(
      event?.registration_closes_at,
      event?.timezone || 'UTC'
    ),
    music_deadline_at: toDatetimeLocalValue(
      event?.music_deadline_at,
      event?.timezone || 'UTC'
    ),
    check_in_opens_at: toDatetimeLocalValue(
      event?.check_in_opens_at,
      event?.timezone || 'UTC'
    ),
    check_in_closes_at: toDatetimeLocalValue(
      event?.check_in_closes_at,
      event?.timezone || 'UTC'
    ),
  }))

  useEffect(() => {
    async function fetchMeta() {
      try {
        const [rulesRes, filtersRes] = await Promise.all([
          fetch('/api/rulesets'),
          fetch('/api/rankings/filters'),
        ])
        const rulesData = await rulesRes.json()
        if (rulesData.rulesets) setRulesets(rulesData.rulesets)
        const filters = await filtersRes.json()
        if (filters.seasons) setSeasons(filters.seasons)
        if (filters.tiers) setTiers(filters.tiers)
        if (filters.geoNodes) {
          setCountries(
            (filters.geoNodes as GeoNode[]).filter((g) => g.level === 'country')
          )
        }
      } catch (error) {
        console.error('Error fetching event form meta:', error)
      }
    }
    fetchMeta()
  }, [])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema) as never,
    defaultValues: {
      name: event?.name || '',
      description: event?.description || '',
      location: event?.location || '',
      event_date: event?.event_date || '',
      timezone: event?.timezone || 'UTC',
      venue_name: event?.venue_name || '',
      address_line1: event?.address_line1 || '',
      address_line2: event?.address_line2 || '',
      city: event?.city || '',
      region: event?.region || '',
      postal_code: event?.postal_code || '',
      country_code: event?.country_code || '',
      website_url: event?.website_url || '',
      organizer_contact_name: event?.organizer_contact_name || '',
      organizer_contact_email: event?.organizer_contact_email || '',
      organizer_contact_public: event?.organizer_contact_public ?? false,
      status: event?.status || 'draft',
      ruleset_id: event?.ruleset_id || undefined,
      season_id: event?.season_id || null,
      tier_id: event?.tier_id || null,
      geo_id: event?.geo_id || null,
    },
  })

  const status = watch('status')
  const rulesetId = watch('ruleset_id')
  const seasonId = watch('season_id')
  const tierId = watch('tier_id')
  const geoId = watch('geo_id')
  const contactPublic = watch('organizer_contact_public')

  const onTimezoneChange = (tz: string) => {
    setTimezone(tz)
    setValue('timezone', tz)
  }

  const onSubmit = async (data: EventFormData) => {
    setLoading(true)
    try {
      const payload: EventFormData = {
        ...data,
        timezone,
        starts_at: fromDatetimeLocalValue(localTiming.starts_at, timezone),
        ends_at: fromDatetimeLocalValue(localTiming.ends_at, timezone),
        registration_opens_at: fromDatetimeLocalValue(
          localTiming.registration_opens_at,
          timezone
        ),
        registration_closes_at: fromDatetimeLocalValue(
          localTiming.registration_closes_at,
          timezone
        ),
        music_deadline_at: fromDatetimeLocalValue(
          localTiming.music_deadline_at,
          timezone
        ),
        check_in_opens_at: fromDatetimeLocalValue(
          localTiming.check_in_opens_at,
          timezone
        ),
        check_in_closes_at: fromDatetimeLocalValue(
          localTiming.check_in_closes_at,
          timezone
        ),
        event_date:
          data.event_date ||
          (localTiming.starts_at ? localTiming.starts_at.slice(0, 10) : null),
        venue_name: data.venue_name || null,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        region: data.region || null,
        postal_code: data.postal_code || null,
        country_code: data.country_code || null,
        website_url: data.website_url || null,
        organizer_contact_name: data.organizer_contact_name || null,
        organizer_contact_email: data.organizer_contact_email || null,
        description: data.description || null,
        location: data.location || null,
      }

      // Empty optional strings → null so Zod url/email/length don't fail
      if (!payload.website_url) payload.website_url = null
      if (!payload.organizer_contact_email) payload.organizer_contact_email = null
      if (!payload.country_code) payload.country_code = null
      if (!payload.event_date) payload.event_date = null

      if (event) {
        const response = await fetch(`/api/events/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || 'Failed to update event')
        }
        toast.success('Event updated successfully')
        router.push(`/admin/events/${event.id}`)
      } else {
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create event')
        }
        toast.success('Event created successfully')
        router.push(`/admin/events/${result.event.id}`)
      }
      router.refresh()
    } catch (error) {
      console.error('Error saving event:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save event')
    } finally {
      setLoading(false)
    }
  }

  const timingField = (
    key: keyof LocalTimingState,
    label: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="datetime-local"
        value={localTiming[key]}
        onChange={(e) =>
          setLocalTiming((prev) => ({ ...prev, [key]: e.target.value }))
        }
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Event Name *</Label>
        <Input
          id="name"
          placeholder="Regional Championship 2024"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Event description..."
          {...register('description')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Location (short)</Label>
          <Input
            id="location"
            placeholder="Convention Center, City"
            {...register('location')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event_date">Legacy event date</Label>
          <Input id="event_date" type="date" {...register('event_date')} />
          <p className="text-xs text-muted-foreground">
            Kept for rankings/history. Prefer start/end below.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="text-sm font-medium">Timing</h3>
        <div className="space-y-2 max-w-md">
          <Label>Timezone (IANA)</Label>
          <Select value={timezone} onValueChange={onTimezoneChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {timingField('starts_at', 'Starts at')}
          {timingField('ends_at', 'Ends at')}
          {timingField('registration_opens_at', 'Registration opens')}
          {timingField('registration_closes_at', 'Registration closes')}
          {timingField('music_deadline_at', 'Music deadline')}
          {timingField('check_in_opens_at', 'Check-in opens')}
          {timingField('check_in_closes_at', 'Check-in closes')}
        </div>
        {errors.starts_at && (
          <p className="text-sm text-destructive">{errors.starts_at.message}</p>
        )}
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="text-sm font-medium">Venue & links</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="venue_name">Venue name</Label>
            <Input id="venue_name" {...register('venue_name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website_url">Website</Label>
            <Input id="website_url" type="url" placeholder="https://" {...register('website_url')} />
            {errors.website_url && (
              <p className="text-sm text-destructive">{errors.website_url.message}</p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address_line1">Address line 1</Label>
            <Input id="address_line1" {...register('address_line1')} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address_line2">Address line 2</Label>
            <Input id="address_line2" {...register('address_line2')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register('city')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region / state</Label>
            <Input id="region" {...register('region')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_code">Postal code</Label>
            <Input id="postal_code" {...register('postal_code')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country_code">Country code (ISO-2)</Label>
            <Input
              id="country_code"
              maxLength={2}
              placeholder="US"
              {...register('country_code')}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="organizer_contact_name">Organizer contact name</Label>
            <Input id="organizer_contact_name" {...register('organizer_contact_name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organizer_contact_email">Organizer contact email</Label>
            <Input
              id="organizer_contact_email"
              type="email"
              {...register('organizer_contact_email')}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={Boolean(contactPublic)}
            onCheckedChange={(v) => setValue('organizer_contact_public', v)}
          />
          <Label>Show organizer contact on public event page</Label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setValue('status', value as EventFormData['status'])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ruleset_id">Competition Rules</Label>
          <Select
            value={rulesetId || 'none'}
            onValueChange={(value) =>
              setValue('ruleset_id', value === 'none' ? undefined : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select ruleset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No ruleset</SelectItem>
              {rulesets.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="text-sm font-medium">League rankings</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Season</Label>
            <Select
              value={seasonId || 'none'}
              onValueChange={(v) => setValue('season_id', v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Event tier</Label>
            <Select
              value={tierId || 'none'}
              onValueChange={(v) => setValue('tier_id', v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {tiers.map((t) => {
                  const races: string[] = []
                  if (t.counts_for_national_race) races.push('National Race')
                  if (t.counts_for_world_race) races.push('World Race')
                  if (!races.length) races.push('Custom League only')
                  return (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} (×{t.multiplier} · {races.join(' + ')})
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Host country</Label>
            <Select
              value={geoId || 'none'}
              onValueChange={(v) => setValue('geo_id', v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : event ? (
            'Update Event'
          ) : (
            'Create Event'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
