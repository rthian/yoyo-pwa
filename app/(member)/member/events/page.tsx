/**
 * Member Events Browse Page
 * Browse available events and register for divisions
 */
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  MapPin,
  Users,
  Loader2,
  CheckCircle,
  UserPlus,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'

interface BrowseEvent {
  id: string
  name: string
  description: string | null
  event_date: string | null
  location: string | null
  status: string
  registration_open: boolean
  divisions: Array<{
    id: string
    name: string
    description: string | null
    scoring_type: string
    round_type: string | null
    max_participants: number | null
    scheduled_start: string | null
    scheduled_end: string | null
    venue: string | null
    is_registered: boolean
    participant_count: number
  }>
}

export default function MemberEventsPage() {
  const [events, setEvents] = useState<BrowseEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [registeringId, setRegisteringId] = useState<string | null>(null)

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events/browse')
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      toast.error('Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleRegistration = async (divisionId: string, isRegistered: boolean) => {
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
      if (!response.ok) {
        throw new Error(result.error || 'Registration failed')
      }

      toast.success(isRegistered ? 'Unregistered successfully' : 'Registered successfully!')
      // Refresh events to update UI
      await fetchEvents()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setRegisteringId(null)
    }
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

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const roundTypeLabels: Record<string, string> = {
    wildcard: 'WildCard',
    qualifier: 'Qualifier',
    semi_final: 'Semi-Final',
    final: 'Final',
    exhibition: 'Exhibition',
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    upcoming: 'bg-blue-100 text-blue-800',
    registration_open: 'bg-purple-100 text-purple-800',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Browse Events</h1>
        <p className="text-muted-foreground mt-1">
          Find upcoming events and register for divisions
        </p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No Events Available</h3>
            <p className="text-muted-foreground mt-1">
              There are no active events at the moment. Check back later!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">{event.name}</CardTitle>
                    {event.description && (
                      <CardDescription className="mt-1">{event.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Badge className={statusColors[event.status] || ''}>
                      {event.status.replace('_', ' ')}
                    </Badge>
                    {event.registration_open && (
                      <Badge variant="outline" className="border-green-500 text-green-700">
                        Registration Open
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                  {event.event_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(event.event_date)}
                    </span>
                  )}
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {event.location}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  Divisions
                </h4>
                <div className="space-y-3">
                  {event.divisions.map((division) => (
                    <div
                      key={division.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-4">
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
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {division.participant_count}
                            {division.max_participants && ` / ${division.max_participants}`}
                            {' participants'}
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

                      {/* Registration Button */}
                      <div className="flex-shrink-0">
                        {division.is_registered ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRegistration(division.id, true)}
                            disabled={registeringId === division.id}
                            className="text-green-700 border-green-300 hover:bg-green-50"
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
                        ) : event.registration_open ? (
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
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
