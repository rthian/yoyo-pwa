/**
 * Public Leaderboards Hub Page
 * Displays all events with publicly shared leaderboard divisions
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, MapPin, Calendar, Eye, ArrowLeft, Loader2, Radio } from 'lucide-react'

interface Division {
  divisionId: string
  divisionName: string
  divisionDescription: string | null
  token: string
  viewsCount: number
}

interface EventWithDivisions {
  eventId: string
  eventName: string
  eventStatus: string
  eventDate: string | null
  eventLocation: string | null
  divisions: Division[]
}

export default function LeaderboardsHubPage() {
  const [events, setEvents] = useState<EventWithDivisions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLeaderboards() {
      try {
        const response = await fetch('/api/leaderboards')
        if (!response.ok) {
          throw new Error('Failed to load leaderboards')
        }
        const data = await response.json()
        setEvents(data.events || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboards')
      } finally {
        setLoading(false)
      }
    }
    fetchLeaderboards()
  }, [])

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default' as const
      case 'completed': return 'secondary' as const
      default: return 'outline' as const
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Loading leaderboards...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Home
        </Link>
        
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Live Leaderboards</h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Follow live scores and rankings from active yo-yo competitions
          </p>
        </div>

        {error && (
          <Card className="max-w-md mx-auto text-center mb-8">
            <CardContent className="py-8">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </CardContent>
          </Card>
        )}

        {!error && events.length === 0 && (
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">No Live Leaderboards</h2>
              <p className="text-muted-foreground">
                There are no publicly shared leaderboards at the moment. Check back during an active event.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Events with Divisions */}
        <div className="max-w-3xl mx-auto space-y-8">
          {events.map((event) => (
            <Card key={event.eventId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{event.eventName}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {event.eventDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(event.eventDate)}
                        </span>
                      )}
                      {event.eventLocation && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.eventLocation}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusBadgeVariant(event.eventStatus)}>
                    {event.eventStatus === 'active' && (
                      <Radio className="h-3 w-3 mr-1 animate-pulse" />
                    )}
                    {event.eventStatus.charAt(0).toUpperCase() + event.eventStatus.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {event.divisions.map((division) => (
                    <Link
                      key={division.divisionId}
                      href={`/leaderboard/${division.divisionId}?token=${division.token}`}
                    >
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer h-full">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{division.divisionName}</p>
                          {division.divisionDescription && (
                            <p className="text-sm text-muted-foreground truncate">
                              {division.divisionDescription}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          {division.viewsCount > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Eye className="h-3 w-3" />
                              {division.viewsCount}
                            </span>
                          )}
                          <Trophy className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>YoYo League</p>
          <p className="text-xs mt-2">© {new Date().getFullYear()} YoYo League. Created by <a href="https://github.com/rthian" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">rthian</a>.</p>
        </div>
      </footer>
    </div>
  )
}
