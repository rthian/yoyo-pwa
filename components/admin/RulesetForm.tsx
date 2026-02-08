/**
 * Ruleset Form Component
 * Handles create and edit for rulesets
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type FieldValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { rulesetSchema } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Ruleset } from '@/lib/types/database'

interface RulesetFormProps {
  ruleset?: Ruleset
}

export default function RulesetForm({ ruleset }: RulesetFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [scoringConfigText, setScoringConfigText] = useState(
    ruleset ? JSON.stringify(ruleset.scoring_config, null, 2) : '{}'
  )
  const [configError, setConfigError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(rulesetSchema),
    defaultValues: {
      name: ruleset?.name || '',
      code: ruleset?.code || '',
      description: ruleset?.description || '',
      version: ruleset?.version || '',
      source_url: ruleset?.source_url || '',
      rules_content: ruleset?.rules_content || '',
      scoring_config: (ruleset?.scoring_config || {}) as Record<string, unknown>,
      is_active: ruleset?.is_active ?? true,
    },
  })

  const isActive = watch('is_active')

  const handleConfigChange = (value: string) => {
    setScoringConfigText(value)
    setConfigError(null)
    try {
      const parsed = JSON.parse(value)
      setValue('scoring_config', parsed)
    } catch {
      setConfigError('Invalid JSON')
    }
  }

  const onSubmit = async (data: FieldValues) => {
    if (configError) {
      toast.error('Please fix the scoring config JSON before saving')
      return
    }

    setLoading(true)

    try {
      // Parse the config text one more time to ensure it's valid
      try {
        data.scoring_config = JSON.parse(scoringConfigText)
      } catch {
        toast.error('Invalid scoring config JSON')
        setLoading(false)
        return
      }

      if (ruleset) {
        const response = await fetch(`/api/rulesets/${ruleset.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update ruleset')
        }

        toast.success('Ruleset updated successfully')
        router.push(`/admin/rules/${ruleset.id}`)
      } else {
        const response = await fetch('/api/rulesets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create ruleset')
        }

        toast.success('Ruleset created successfully')
        router.push(`/admin/rules/${result.ruleset.id}`)
      }

      router.refresh()
    } catch (error) {
      console.error('Error saving ruleset:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save ruleset')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Ruleset Name *</Label>
          <Input
            id="name"
            placeholder="IYYF World Yo-Yo Contest 2025"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="code">Ruleset Code *</Label>
          <Input
            id="code"
            placeholder="IYYF_WYYC_25"
            {...register('code')}
            disabled={!!ruleset}
            className={ruleset ? 'bg-muted' : ''}
          />
          <p className="text-xs text-muted-foreground">
            Uppercase letters, numbers, and underscores only
          </p>
          {errors.code && (
            <p className="text-sm text-destructive">{errors.code.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Brief description of the ruleset..."
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            placeholder="2025"
            {...register('version')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="source_url">Source URL</Label>
          <Input
            id="source_url"
            placeholder="https://example.com/rules"
            {...register('source_url')}
          />
          {errors.source_url && (
            <p className="text-sm text-destructive">{errors.source_url.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rules_content">Rules Content (Markdown)</Label>
        <textarea
          id="rules_content"
          className="flex min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="# Rules&#10;&#10;Write your rules content in Markdown format..."
          {...register('rules_content')}
        />
        <p className="text-xs text-muted-foreground">
          Full rules content in Markdown format. This will be rendered for users to read.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scoring_config">Scoring Configuration (JSON)</Label>
        <textarea
          id="scoring_config"
          className={`flex min-h-60 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            configError ? 'border-destructive' : 'border-input'
          }`}
          value={scoringConfigText}
          onChange={(e) => handleConfigChange(e.target.value)}
        />
        {configError && (
          <p className="text-sm text-destructive">{configError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          JSON configuration for scoring weights, categories, deductions, and round structures.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="is_active"
          checked={isActive}
          onCheckedChange={(checked) => setValue('is_active', checked)}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : ruleset ? (
            'Update Ruleset'
          ) : (
            'Create Ruleset'
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
