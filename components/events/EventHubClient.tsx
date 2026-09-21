/**
 * Event hub UI: Register + Schedule + Boards for one contest.
 * Called by: app/events/[id]/page.tsx
 * Fetches GET /api/events/[id]/hub; register via POST /api/member/events/register
 * Glob: no prior components/events/*
 * User: "yes" (start event hub)
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Coffee,
  Flag,
  Loader2,
  MapPin,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

type TabId = 'register' | 'schedule' | 'boards'

interface HubDivision {
  id: string
  name: string
  description: string | null
  scoring_type: string
  round_type: string | null
  max_participants: number | null
  scheduled_start: string | null
  scheduled_end: string | null
  venue: string | null
  scoring_locked: boolean
  is_registered: boolean
  participant_count: number
}

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
}

interface HubPayload {
  event: {
    id: string
    name: string
    description: string | null
    event_date: string | null
    location: string | null
    status: string
  }
  registrationOpen: boolean
  authenticated: boolean
  divisions: HubDivision[]
  schedule: ScheduleItem[]
  myBoards: { divisionId: string; divisionName: string; scoringLocked: boolean }[]
  publicBoards: {
    divisionId: string
    divisionName: string
    token: string
    viewsCount: number
    scoringLocked: boolean
  }[]
}

const roundTypeLabels: Record<string, string> = {
  wildcard: 'WildCard',
  qualifier: 'Qualifier',
  semi_final: 'Semi-Final',
  final: 'Final',
  exhibition: 'Exhibition',
}

const roundTypeColors: Record<string, string> = {
  wildcard: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  qualifier: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  semi_final: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  final: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  exhibition: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
}

const entryTypeIcons: Record<string, typeof Coffee> = {
  ceremony: Flag,
  break: Coffee,
  registration: Users,
  other: Clock,
}

const entryTypeColors: Record<string, string> = {
  ceremony: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  break: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  registration: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function parseTab(value: string | null): TabId {
  if (value === 'schedule' || value === 'boards' || value === 'register') return value
  return 'register'
}

export default function EventHubClient({ eventId }: { eventId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabId>(() => parseTab(searchParams.get('tab')))
  const [data, setData] = useState<HubPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registeringId, setRegisteringId] = useState<string | null>(null)

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    try {
      const res = await fetch(`/api/events/${eventId}/hub`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load event')
      setData(json)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load event'
      if (opts?.soft) {
        toast.error(message)
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setTab(parseTab(searchParams.get('tab')))
  }, [searchParams])

  const onTabChange = (value: string) => {
    const next = parseTab(value)
    setTab(next)
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'register') params.delete('tab')
    else params.set('tab', next)
    const qs = params.toString()
    router.replace(qs ? `/events/${eventId}?${qs}` : `/events/${eventId}`, { scroll: false })
  }

  const handleRegistration = async (divisionId: string, isRegistered: boolean) => {
    if (!data?.authenticated) {
      router.push(`/login?redirect=${encodeURIComponent(`/events/${eventId}?tab=register`)}`)
      return
    }
    setRegisteringId(divisionId)
    try {
      const response = await fetch('/api/member/events/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          division_id: divisionId,
          action: isRegistered ? 'unregister' : 'register',
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Registration failed')
      toast.success(isRegistered ? 'Unregistered' : 'Registered')
      await load({ soft: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setRegisteringId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-destructive">{error || 'Event not found'}</p>
            <Link href="/">
              <Button variant="outline">Back home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { event, divisions, schedule, myBoards, publicBoards, registrationOpen, authenticated } =
    data

  const groupedByDate = schedule.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    const dateKey = item.scheduled_start
      ? new Date(item.scheduled_start).toDateString()
      : 'Unscheduled'
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(item)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-start gap-3">
            <Link href={data.authenticated ? '/member/events' : '/'}>
              <Button variant="ghost" size="icon" aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight truncate">{event.name}</h1>
                <Badge variant="secondary" className="capitalize">
                  {event.status}
                </Badge>
                {registrationOpen && (
                  <Badge variant="outline" className="border-green-500 text-green-700">
                    Registration open
                  </Badge>
                )}
              </div>
              {event.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
                {event.event_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(event.event_date)}
                  </span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {event.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="register">Register</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="boards">Boards</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-4">
            {!authenticated && (
              <Card>
                <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Sign in to register for divisions at this event.
                  </p>
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/events/${eventId}?tab=register`)}`}
                  >
                    <Button size="sm">Sign in</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {divisions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No divisions published yet.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {divisions.map((division) => (
                  <Card key={division.id}>
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{division.name}</span>
                          {division.round_type && (
                            <Badge variant="outline" className="text-xs">
                              {roundTypeLabels[division.round_type] || division.round_type}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {division.scoring_type}
                          </Badge>
                        </div>
                        {division.description && (
                          <p className="text-sm text-muted-foreground mt-1">{division.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {division.participant_count}
                            {division.max_participants && ` / ${division.max_participants}`}
                          </span>
                          {division.scheduled_start && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(division.scheduled_start)}
                            </span>
                          )}
                          {division.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {division.venue}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {division.is_registered && registrationOpen ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRegistration(division.id, true)}
                            disabled={registeringId === division.id}
                            className="text-green-700 border-green-300"
                          >
                            {registeringId === division.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Registered
                              </>
                            )}
                          </Button>
                        ) : division.is_registered ? (
                          <Badge className="bg-green-100 text-green-800">Registered</Badge>
                        ) : registrationOpen ? (
                          <Button
                            size="sm"
                            onClick={() => handleRegistration(division.id, false)}
                            disabled={registeringId === division.id}
                          >
                            {registeringId === division.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4 mr-1" />
                                Register
                              </>
                            )}
                          </Button>
                        ) : (
                          <Badge variant="secondary">Closed</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
            {schedule.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-1">No schedule yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Check back once the organizer publishes times.
                  </p>
                </CardContent>
              </Card>
            ) : (
              Object.entries(groupedByDate).map(([dateKey, items]) => (
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
                        <Card key={`${item.type}-${item.id}`}>
                          <CardContent className="flex items-center gap-4 p-4">
                            <div className="w-16 text-center shrink-0">
                              {item.scheduled_start ? (
                                <div>
                                  <p className="text-lg font-bold">{formatTime(item.scheduled_start)}</p>
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
                            <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
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
              ))
            )}
          </TabsContent>

          <TabsContent value="boards" className="space-y-6">
            {myBoards.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  My divisions
                </h2>
                {myBoards.map((b) => (
                  <Link key={b.divisionId} href={`/leaderboard/${b.divisionId}`}>
                    <Card className="hover:bg-accent/40 transition-colors mb-2">
                      <CardContent className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-primary" />
                          <span className="font-medium">{b.divisionName}</span>
                        </div>
                        <Badge variant={b.scoringLocked ? 'secondary' : 'outline'}>
                          {b.scoringLocked ? 'Final' : 'Live'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Public boards
              </h2>
              {publicBoards.filter(
                (b) => !myBoards.some((m) => m.divisionId === b.divisionId)
              ).length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">No public boards yet</CardTitle>
                    <CardDescription>
                      When the organizer shares a division board, it will show up here.
                      {authenticated && myBoards.length === 0
                        ? ' Register for a division to follow your own scores.'
                        : ''}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                publicBoards
                  .filter((b) => !myBoards.some((m) => m.divisionId === b.divisionId))
                  .map((b) => (
                  <Link
                    key={b.divisionId}
                    href={`/leaderboard/${b.divisionId}?token=${encodeURIComponent(b.token)}`}
                  >
                    <Card className="hover:bg-accent/40 transition-colors mb-2">
                      <CardContent className="flex items-center justify-between py-3">
                        <div>
                          <p className="font-medium">{b.divisionName}</p>
                          <p className="text-xs text-muted-foreground">{b.viewsCount} views</p>
                        </div>
                        <Badge variant={b.scoringLocked ? 'secondary' : 'outline'}>
                          {b.scoringLocked ? 'Final' : 'Live'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
