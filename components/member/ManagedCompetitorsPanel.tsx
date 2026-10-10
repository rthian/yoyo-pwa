/**
 * Prompt 17: list / add / edit / revoke managed competitors.
 * Callers: app/(member)/member/competitors/page.tsx
 * Glob: no prior ManagedCompetitorsPanel
 * Sample: { full_name: "Kid Ada", relationship: "guardian", can_register: true }
 * User: "Start build"
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { CompetitorRelationship } from '@/lib/types/database'
import type { SelectableCompetitor } from '@/components/member/CompetitorSelector'

type Row = SelectableCompetitor & {
  link: SelectableCompetitor['link'] & { id: string }
}

export default function ManagedCompetitorsPanel() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [relationship, setRelationship] =
    useState<Exclude<CompetitorRelationship, 'self'>>('guardian')
  const [canRegister, setCanRegister] = useState(true)
  const [canMusic, setCanMusic] = useState(false)
  const [canProfile, setCanProfile] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/member/competitors')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setRows(
        (data.competitors || []).map(
          (c: SelectableCompetitor & { link: { id: string } }) => ({
            ...c,
            link: c.link,
          })
        )
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    if (!fullName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/member/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          nickname: nickname.trim() || null,
          relationship,
          can_register: canRegister,
          can_manage_music: canMusic,
          can_manage_profile: canProfile,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      toast.success('Competitor added')
      setOpen(false)
      setFullName('')
      setNickname('')
      setRelationship('guardian')
      setCanRegister(true)
      setCanMusic(false)
      setCanProfile(true)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const patchCap = async (
    linkId: string,
    patch: Partial<{
      can_register: boolean
      can_manage_music: boolean
      can_manage_profile: boolean
    }>
  ) => {
    try {
      const res = await fetch(`/api/member/competitors/links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const revoke = async (linkId: string, name: string) => {
    if (!confirm(`Stop managing ${name}? Their competition history is kept.`)) {
      return
    }
    try {
      const res = await fetch(`/api/member/competitors/links/${linkId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Revoke failed')
      toast.success('Link removed')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Revoke failed')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading competitors…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add competitor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add competitor</DialogTitle>
              <DialogDescription>
                Create a profile you manage (e.g. a child or mentee). They do not
                need their own login.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="comp-name">Full name</Label>
                <Input
                  id="comp-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comp-nick">Nickname (optional)</Label>
                <Input
                  id="comp-nick"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Relationship</Label>
                <Select
                  value={relationship}
                  onValueChange={(v) =>
                    setRelationship(v as typeof relationship)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guardian">Guardian</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cap-reg">Can register for events</Label>
                  <Switch
                    id="cap-reg"
                    checked={canRegister}
                    onCheckedChange={setCanRegister}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="cap-music">Can manage music</Label>
                  <Switch
                    id="cap-music"
                    checked={canMusic}
                    onCheckedChange={setCanMusic}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="cap-profile">Can manage profile</Label>
                  <Switch
                    id="cap-profile"
                    checked={canProfile}
                    onCheckedChange={setCanProfile}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create} disabled={saving || !fullName.trim()}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Create'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No competitors yet. Your account should create a self profile on signup.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.link.id}
              className="rounded-lg border p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{row.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[row.public_id, row.nickname].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {row.link.relationship === 'self'
                    ? 'You'
                    : row.link.relationship}
                </Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <label className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                  <span>Register</span>
                  <Switch
                    checked={row.link.can_register}
                    disabled={row.link.relationship === 'self'}
                    onCheckedChange={(v) =>
                      patchCap(row.link.id, { can_register: v })
                    }
                  />
                </label>
                <label className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                  <span>Music</span>
                  <Switch
                    checked={row.link.can_manage_music}
                    onCheckedChange={(v) =>
                      patchCap(row.link.id, { can_manage_music: v })
                    }
                  />
                </label>
                <label className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                  <span>Profile</span>
                  <Switch
                    checked={row.link.can_manage_profile}
                    onCheckedChange={(v) =>
                      patchCap(row.link.id, { can_manage_profile: v })
                    }
                  />
                </label>
              </div>
              {row.link.relationship !== 'self' && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => revoke(row.link.id, row.full_name)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Stop managing
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
