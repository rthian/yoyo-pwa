/**
 * Public Event Schedule Page
 * Displays the full contest schedule for participants and spectators
 */
'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Coffee,
  Flag,
  Users,
  Loader2,
} from 'lucide-react'

interface ScheduleItem {
  id: string
  name?: string
  title?: string
  description: string | null
  type: 'division' | 'entry'
  round_type?: string | null
  entry_type?: string
  scheduled_start: string | null
  scheduled_end: string | null
  venue: string | null
  sort_order: number
  is_active?: boolean
}

interface EventInfo {
  id: string
  name: string
  event_date: string | null
  location: string | null
}

const roundTypeLabels: Record<string, string> = {
  wildcard: 'WildCard',
  qualifier: 'Qualifier / Prelim',
  semi_final: 'Semi-Final',
  final: 'Final',
  exhibition: 'Exhibition',
  other: 'Other',
}

const entryTypeIcons: Record<string, typeof Coffee> = {
  ceremony: Flag,
  break: Coffee,
  registration: Users,
  other: Clock,
}

const roundTypeColors: Record<string, string> = {
  wildcard: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  qualifier: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  semi_final: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  final: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  exhibition: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
}

const entryTypeColors: Record<string, string> = {
  ceremony: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  break: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  registration: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

export default function PublicSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/schedule/${eventId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch schedule')
        }

        setSchedule(data.schedule || [])

        // Also fetch event info
        const eventResponse = await fetch(`/api/events/${eventId}`)
        if (eventResponse.ok) {
          const eventData = await eventResponse.json()
          setEventInfo(eventData.event)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schedule')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [eventId])

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Group schedule items by date
  const groupedByDate = schedule.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    const dateKey = item.scheduled_start
      ? new Date(item.scheduled_start).toDateString()
      : 'Unscheduled'
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(item)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">
                {eventInfo?.name || 'Event'} Schedule
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {eventInfo?.event_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(eventInfo.event_date).toLocaleDateString()}
                  </span>
                )}
                {eventInfo?.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {eventInfo.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : schedule.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No schedule available yet</h3>
              <p className="text-muted-foreground text-center">
                The event schedule hasn&apos;t been published yet. Check back later!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByDate).map(([dateKey, items]) => (
              <div key={dateKey}>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {dateKey === 'Unscheduled'
                    ? 'Time TBD'
                    : formatDate(items[0].scheduled_start)}
                </h2>
                <div className="space-y-2">
                  {items.map((item) => {
                    const isDivision = item.type === 'division'
                    const displayName = isDivision ? item.name : item.title
                    const Icon = isDivision
                      ? Trophy
                      : entryTypeIcons[item.entry_type || 'other'] || Clock

                    const badgeColor = isDivision
                      ? roundTypeColors[item.round_type || ''] || 'bg-primary/10 text-primary'
                      : entryTypeColors[item.entry_type || 'other']

                    const badgeLabel = isDivision
                      ? roundTypeLabels[item.round_type || ''] || 'Competition'
                      : (item.entry_type || 'Other').charAt(0).toUpperCase() +
                        (item.entry_type || 'other').slice(1)

                    return (
                      <Card key={`${item.type}-${item.id}`} className="overflow-hidden">
                        <CardContent className="flex items-center gap-4 p-4">
                          <div className="flex-shrink-0 w-16 text-center">
                            {item.scheduled_start ? (
                              <div>
                                <p className="text-lg font-bold">
                                  {formatTime(item.scheduled_start)}
                                </p>
                                {item.scheduled_end && (
                                  <p className="text-xs text-muted-foreground">
                                    to {formatTime(item.scheduled_end)}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">TBD</p>
                            )}
                          </div>
                          <div className="w-px h-12 bg-border" />
                          <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{displayName}</span>
                              <Badge className={badgeColor}>{badgeLabel}</Badge>
                            </div>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                                {item.description}
                              </p>
                            )}
                            {item.venue && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {item.venue}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
