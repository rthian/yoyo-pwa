/**
 * Schedule Manager Component
 * Manages schedule entries (ceremonies, breaks, etc.) for an event
 */
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Plus, Trash2, Clock, MapPin, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ScheduleEntry, ScheduleEntryType } from '@/lib/types/database'

interface ScheduleManagerProps {
  eventId: string
}

const entryTypeLabels: Record<ScheduleEntryType, string> = {
  ceremony: 'Ceremony',
  break: 'Break',
  registration: 'Registration',
  other: 'Other',
}

const entryTypeColors: Record<ScheduleEntryType, string> = {
  ceremony: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  break: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  registration: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

interface NewEntryForm {
  title: string
  description: string
  entry_type: ScheduleEntryType
  scheduled_start: string
  scheduled_end: string
  venue: string
  sort_order: number
}

const defaultNewEntry: NewEntryForm = {
  title: '',
  description: '',
  entry_type: 'other',
  scheduled_start: '',
  scheduled_end: '',
  venue: '',
  sort_order: 0,
}

export default function ScheduleManager({ eventId }: ScheduleManagerProps) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newEntry, setNewEntry] = useState<NewEntryForm>(defaultNewEntry)

  useEffect(() => {
    fetchEntries()
  }, [eventId])

  const fetchEntries = async () => {
    try {
      const response = await fetch(`/api/schedule/${eventId}`)
      const data = await response.json()
      if (data.entries) {
        setEntries(data.entries)
      }
    } catch (error) {
      console.error('Error fetching schedule entries:', error)
      toast.error('Failed to load schedule entries')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newEntry.title.trim()) {
      toast.error('Title is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/schedule/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEntry,
          event_id: eventId,
          scheduled_start: newEntry.scheduled_start || null,
          scheduled_end: newEntry.scheduled_end || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create entry')
      }

      toast.success('Schedule entry created')
      setDialogOpen(false)
      setNewEntry(defaultNewEntry)
      fetchEntries()
    } catch (error) {
      console.error('Error creating entry:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create entry')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (entryId: string) => {
    try {
      const response = await fetch(`/api/schedule/entries/${entryId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to delete entry')
      }

      toast.success('Schedule entry deleted')
      setEntries(entries.filter(e => e.id !== entryId))
    } catch (error) {
      console.error('Error deleting entry:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete entry')
    }
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add non-division schedule items like ceremonies, breaks, and registration periods
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Schedule Entry</DialogTitle>
              <DialogDescription>
                Create a non-division schedule item for this event
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                  placeholder="Opening Ceremony"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  placeholder="Brief description..."
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newEntry.entry_type}
                    onValueChange={(v) => setNewEntry({ ...newEntry, entry_type: v as ScheduleEntryType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ceremony">Ceremony</SelectItem>
                      <SelectItem value="break">Break</SelectItem>
                      <SelectItem value="registration">Registration</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Venue / Stage</Label>
                  <Input
                    value={newEntry.venue}
                    onChange={(e) => setNewEntry({ ...newEntry, venue: e.target.value })}
                    placeholder="Main Hall"
                  />
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="datetime-local"
                    value={newEntry.scheduled_start}
                    onChange={(e) => setNewEntry({ ...newEntry, scheduled_start: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="datetime-local"
                    value={newEntry.scheduled_end}
                    onChange={(e) => setNewEntry({ ...newEntry, scheduled_end: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={newEntry.sort_order}
                  onChange={(e) => setNewEntry({ ...newEntry, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Entry'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No schedule entries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{entry.title}</span>
                    <Badge className={entryTypeColors[entry.entry_type]}>
                      {entryTypeLabels[entry.entry_type]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {entry.scheduled_start && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(entry.scheduled_start)} {formatTime(entry.scheduled_start)}
                        {entry.scheduled_end && ` - ${formatTime(entry.scheduled_end)}`}
                      </span>
                    )}
                    {entry.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {entry.venue}
                      </span>
                    )}
                  </div>
                  {entry.description && (
                    <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
