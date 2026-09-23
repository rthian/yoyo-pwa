/**
 * Event Form Component
 * Handles create and edit for events
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

interface EventFormProps {
  event?: Event
}

export default function EventForm({ event }: EventFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [rulesets, setRulesets] = useState<Ruleset[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [tiers, setTiers] = useState<EventTier[]>([])
  const [countries, setCountries] = useState<GeoNode[]>([])

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
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: event?.name || '',
      description: event?.description || '',
      location: event?.location || '',
      event_date: event?.event_date || '',
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

  const onSubmit = async (data: EventFormData) => {
    setLoading(true)

    try {
      if (event) {
        // Update existing event via API
        const response = await fetch(`/api/events/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update event')
        }

        toast.success('Event updated successfully')
        router.push(`/admin/events/${event.id}`)
      } else {
        // Create new event via API
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
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
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="Convention Center, City"
            {...register('location')}
          />
          {errors.location && (
            <p className="text-sm text-destructive">{errors.location.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="event_date">Event Date</Label>
          <Input
            id="event_date"
            type="date"
            {...register('event_date')}
          />
          {errors.event_date && (
            <p className="text-sm text-destructive">{errors.event_date.message}</p>
          )}
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
          {errors.status && (
            <p className="text-sm text-destructive">{errors.status.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ruleset_id">Competition Rules</Label>
          <Select
            value={rulesetId || 'none'}
            onValueChange={(value) => setValue('ruleset_id', value === 'none' ? undefined : value)}
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
          <p className="text-xs text-muted-foreground">
            The competition ruleset defines scoring categories and deductions
          </p>
          {errors.ruleset_id && (
            <p className="text-sm text-destructive">{errors.ruleset_id.message}</p>
          )}
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
