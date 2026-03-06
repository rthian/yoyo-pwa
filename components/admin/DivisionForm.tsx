/**
 * Division Form Component
 * Handles create and edit for divisions
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { divisionSchema, type DivisionFormData } from '@/lib/validations'
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
import type { Division } from '@/lib/types/database'

interface DivisionFormProps {
  eventId: string
  division?: Division
}

export default function DivisionForm({ eventId, division }: DivisionFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DivisionFormData>({
    resolver: zodResolver(divisionSchema),
    defaultValues: {
      event_id: eventId,
      name: division?.name || '',
      description: division?.description || '',
      scoring_type: division?.scoring_type || 'standard',
      sort_order: division?.sort_order || 0,
      is_active: division?.is_active ?? true,
      hide_scores_until_complete: division?.hide_scores_until_complete ?? false,
      round_type: division?.round_type || undefined,
      scheduled_start: division?.scheduled_start ? new Date(division.scheduled_start).toISOString().slice(0, 16) : '',
      scheduled_end: division?.scheduled_end ? new Date(division.scheduled_end).toISOString().slice(0, 16) : '',
      venue: division?.venue || '',
    },
  })

  const scoringType = watch('scoring_type')
  const isActive = watch('is_active')
  const hideScoresUntilComplete = watch('hide_scores_until_complete')
  const roundType = watch('round_type')

  const onSubmit = async (data: DivisionFormData) => {
    setLoading(true)

    try {
      if (division) {
        // Update existing division via API
        const response = await fetch(`/api/divisions/${division.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update division')
        }

        toast.success('Division updated successfully')
        router.push(`/admin/events/${eventId}/divisions/${division.id}`)
      } else {
        // Create new division via API
        const response = await fetch('/api/divisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create division')
        }

        toast.success('Division created successfully')
        router.push(`/admin/events/${eventId}/divisions/${result.division.id}`)
      }

      router.refresh()
    } catch (error) {
      console.error('Error saving division:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save division')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Division Name *</Label>
        <Input
          id="name"
          placeholder="1A / Single A"
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
          placeholder="Division description..."
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scoring_type">Scoring Type</Label>
          <Select
            value={scoringType}
            onValueChange={(value) => setValue('scoring_type', value as DivisionFormData['scoring_type'])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select scoring type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="clicker">Clicker</SelectItem>
              <SelectItem value="head_to_head">Head to Head</SelectItem>
            </SelectContent>
          </Select>
          {errors.scoring_type && (
            <p className="text-sm text-destructive">{errors.scoring_type.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sort_order">Sort Order</Label>
          <Input
            id="sort_order"
            type="number"
            {...register('sort_order', { valueAsNumber: true })}
          />
          {errors.sort_order && (
            <p className="text-sm text-destructive">{errors.sort_order.message}</p>
          )}
        </div>
      </div>

      {/* Schedule & Round Info */}
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="text-sm font-medium">Schedule & Round</h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="round_type">Round Type</Label>
            <Select
              value={roundType || 'none'}
              onValueChange={(value) => setValue('round_type', value === 'none' ? undefined : value as DivisionFormData['round_type'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select round type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                <SelectItem value="wildcard">WildCard</SelectItem>
                <SelectItem value="qualifier">Qualifier / Prelim</SelectItem>
                <SelectItem value="semi_final">Semi-Final</SelectItem>
                <SelectItem value="final">Final</SelectItem>
                <SelectItem value="exhibition">Exhibition</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue">Venue / Stage</Label>
            <Input
              id="venue"
              placeholder="Main Stage, Room A, etc."
              {...register('venue')}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="scheduled_start">Scheduled Start</Label>
            <Input
              id="scheduled_start"
              type="datetime-local"
              {...register('scheduled_start')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduled_end">Scheduled End</Label>
            <Input
              id="scheduled_end"
              type="datetime-local"
              {...register('scheduled_end')}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="is_active" className="text-base">Active</Label>
          <p className="text-sm text-muted-foreground">
            Allow judges to submit scores for this division
          </p>
        </div>
        <Switch
          id="is_active"
          checked={isActive}
          onCheckedChange={(checked) => setValue('is_active', checked)}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="hide_scores_until_complete" className="text-base">Hide Leaderboard Until Complete</Label>
          <p className="text-sm text-muted-foreground">
            Show &quot;Scoring in progress&quot; on public leaderboard until head judge locks the division
          </p>
        </div>
        <Switch
          id="hide_scores_until_complete"
          checked={hideScoresUntilComplete}
          onCheckedChange={(checked) => setValue('hide_scores_until_complete', checked)}
        />
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : division ? (
            'Update Division'
          ) : (
            'Create Division'
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
