/**
 * Prompt 17: pick a managed competitor (filtered by capability).
 * Callers: member events page, music page.
 * Glob: no prior CompetitorSelector
 * Sample: { id: "comp_demo", full_name: "Ada", link: { can_register: true } }
 * User: "Start build"
 */
'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { CompetitorRelationship } from '@/lib/types/database'

export type SelectableCompetitor = {
  id: string
  full_name: string
  nickname: string | null
  public_id: string | null
  link: {
    relationship: CompetitorRelationship
    can_register: boolean
    can_manage_music: boolean
    can_manage_profile: boolean
  }
}

type CapabilityFilter = 'register' | 'music' | 'any'

interface CompetitorSelectorProps {
  competitors: SelectableCompetitor[]
  value: string
  onChange: (competitorId: string) => void
  capability?: CapabilityFilter
  label?: string
  disabled?: boolean
  id?: string
}

function allows(c: SelectableCompetitor, capability: CapabilityFilter) {
  if (capability === 'any') return true
  if (capability === 'register') return c.link.can_register
  return c.link.can_manage_music
}

export default function CompetitorSelector({
  competitors,
  value,
  onChange,
  capability = 'any',
  label = 'Competitor',
  disabled,
  id = 'competitor-select',
}: CompetitorSelectorProps) {
  const options = competitors.filter((c) => allows(c, capability))

  if (options.length <= 1) {
    const only = options[0]
    if (!only) {
      return (
        <p className="text-sm text-muted-foreground">
          No competitors available for this action. Add one under Competitors.
        </p>
      )
    }
    return (
      <div className="space-y-1">
        {label && (
          <Label htmlFor={id} className="text-muted-foreground">
            {label}
          </Label>
        )}
        <p id={id} className="text-sm font-medium">
          {only.full_name}
          {only.link.relationship !== 'self' && (
            <span className="ml-2 text-xs text-muted-foreground capitalize">
              ({only.link.relationship})
            </span>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full max-w-sm">
          <SelectValue placeholder="Select competitor" />
        </SelectTrigger>
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.full_name}
              {c.link.relationship !== 'self'
                ? ` (${c.link.relationship})`
                : ' (you)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
