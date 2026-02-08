/**
 * Member Dashboard View
 * Shows member-specific dashboard with upcoming sessions, events, scoreboards, and profile
 */
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Trophy,
  User,
  Clock,
  MapPin,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import type { Member } from '@/lib/types/database'
import MemberHeader from '@/components/shared/MemberHeader'
import { formatCountryWithFlag } from '@/lib/utils/country-flags'

interface MemberDashboardViewProps {
  member: Member
}

interface MemberEvent {
  id: string
  name: string
  event_date: string | null
  location: string | null
  status: string
  divisions: Array<{
    id: string
    name: string
    round_type: string | null
    scheduled_start: string | null
    scheduled_end: string | null
    venue: string | null
  }>
}

export default function MemberDashboardView({ member }: MemberDashboardViewProps) {
  const [events, setEvents] = useState<MemberEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMemberData() {
      try {
        const response = await fetch('/api/member/events')
        if (response.ok) {
          const data = await response.json()
          setEvents(data.events || [])
        }
      } catch (error) {
        console.error('Error fetching member events:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMemberData()
  }, [])

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const roundTypeLabels: Record<string, string> = {
    wildcard: 'WildCard',
    qualifier: 'Qualifier',
    semi_final: 'Semi-Final',
    final: 'Final',
    exhibition: 'Exhibition',
  }

  // Get upcoming sessions across all events
  const upcomingSessions = events
    .flatMap(event =>
      event.divisions
        .filter(d => d.scheduled_start)
        .map(d => ({
          ...d,
          eventName: event.name,
          eventId: event.id,
        }))
    )
    .filter(s => new Date(s.scheduled_start!) >= new Date())
    .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())
    .slice(0, 5)

  const countryDisplay = formatCountryWithFlag(member.country)

  return (
    <>
      <MemberHeader />
      <main className="min-h-screen bg-gradient-to-b from-background to-muted">
        <div className="container mx-auto px-4 py-8">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">
              Welcome, {member.nickname || member.full_name}
            </h1>
            <p className="text-muted-foreground mt-1">
              {countryDisplay && <span className="mr-2">{countryDisplay}</span>}
              {countryDisplay ? '· ' : ''}Here&apos;s your competition overview
            </p>
          </div>

          {/* Upcoming Sessions - Priority Section */}
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Upcoming Sessions
              </CardTitle>
              <CardDescription>Your next scheduled competition sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : upcomingSessions.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-4 p-3 rounded-lg border"
                    >
                      <div className="flex-shrink-0 text-center min-w-[60px]">
                        <p className="text-lg font-bold">{formatTime(session.scheduled_start)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(session.scheduled_start)}
                        </p>
                      </div>
                      <div className="w-px h-10 bg-border" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{session.name}</span>
                          {session.round_type && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {roundTypeLabels[session.round_type] || session.round_type}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{session.eventName}</p>
                        {session.venue && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {session.venue}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No upcoming sessions scheduled</p>
                  <Link href="/member/events" className="text-sm text-primary hover:underline mt-1 inline-block">
                    Browse events to register
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Two Column Layout */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* My Events */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-5 w-5" />
                      My Events
                    </CardTitle>
                    <CardDescription>Events you&apos;re registered in</CardDescription>
                  </div>
                  <Link href="/member/events">
                    <Button variant="outline" size="sm">
                      Browse All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : events.length > 0 ? (
                  <div className="space-y-3">
                    {events.map((event) => (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}/schedule`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <div>
                          <p className="font-medium">{event.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {event.event_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(event.event_date)}
                              </span>
                            )}
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 mt-1.5">
                            {event.divisions.map((d) => (
                              <Badge key={d.id} variant="secondary" className="text-xs">
                                {d.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Not registered for any events yet</p>
                    <Link href="/member/events" className="text-sm text-primary hover:underline mt-1 inline-block">
                      Browse available events
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Access */}
            <div className="space-y-6">
              {/* Scoreboards */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Trophy className="h-5 w-5" />
                    Scoreboards
                  </CardTitle>
                  <CardDescription>View live scores and rankings</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/leaderboards">
                    <Button variant="outline" className="w-full">
                      <Trophy className="h-4 w-4 mr-2" />
                      View Public Leaderboards
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5" />
                    My Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="rounded-full bg-primary h-12 w-12 flex items-center justify-center text-primary-foreground font-semibold">
                        {member.full_name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium">{member.full_name}</p>
                        {member.nickname && (
                          <p className="text-sm text-muted-foreground">&quot;{member.nickname}&quot;</p>
                        )}
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        {countryDisplay && (
                          <p className="text-sm">{countryDisplay}</p>
                        )}
                      </div>
                    </div>
                    <Link href="/member/profile">
                      <Button variant="outline" size="sm" className="w-full">
                        Edit Profile
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
