/**
 * Member Profile Page
 * View/edit profile with participation history and rankings
 */
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  User,
  Trophy,
  Calendar,
  MapPin,
  Medal,
  History,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Member } from '@/lib/types/database'
import { formatCountryWithFlag, getCountryFlag } from '@/lib/utils/country-flags'

interface ParticipationEntry {
  id: string
  registered_at: string
  status: string
  division: {
    id: string
    name: string
    round_type: string | null
  }
  event: {
    id: string
    name: string
    event_date: string | null
    location: string | null
    status: string
  } | null
  scores: {
    count: number
    average: number | null
  }
  ranking: {
    rank: number
    total: number
  } | null
}

export default function MemberProfilePage() {
  const router = useRouter()
  const [member, setMember] = useState<Member | null>(null)
  const [history, setHistory] = useState<ParticipationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    nickname: '',
    country: '',
  })

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch('/api/member/profile')
        if (response.ok) {
          const data = await response.json()
          setMember(data.member)
          setFormData({
            full_name: data.member.full_name || '',
            nickname: data.member.nickname || '',
            country: data.member.country || '',
          })
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        toast.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    async function fetchHistory() {
      try {
        const response = await fetch('/api/member/history')
        if (response.ok) {
          const data = await response.json()
          setHistory(data.history || [])
        }
      } catch (error) {
        console.error('Error fetching history:', error)
      } finally {
        setHistoryLoading(false)
      }
    }

    fetchProfile()
    fetchHistory()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/member/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile')
      }

      setMember(result.member)
      toast.success('Profile updated successfully')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
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

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    if (rank === 2) return 'bg-gray-100 text-gray-700 border-gray-300'
    if (rank === 3) return 'bg-orange-100 text-orange-800 border-orange-300'
    return ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const countryFlag = getCountryFlag(member?.country)
  const countryDisplay = formatCountryWithFlag(member?.country)

  // Group history by event
  const eventGroups = history.reduce<Record<string, { event: ParticipationEntry['event']; entries: ParticipationEntry[] }>>((acc, entry) => {
    const eventId = entry.event?.id || 'unknown'
    if (!acc[eventId]) {
      acc[eventId] = { event: entry.event, entries: [] }
    }
    acc[eventId].entries.push(entry)
    return acc
  }, {})

  const totalEvents = Object.keys(eventGroups).length
  const totalDivisions = history.length
  const bestRank = history
    .filter(h => h.ranking)
    .reduce<number | null>((best, h) => {
      if (!h.ranking) return best
      if (best === null) return h.ranking.rank
      return Math.min(best, h.ranking.rank)
    }, null)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Profile Header */}
      <div className="flex items-center gap-6 mb-8">
        <div className="rounded-full bg-primary h-20 w-20 flex items-center justify-center text-primary-foreground font-bold text-2xl flex-shrink-0">
          {member?.full_name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div>
          <h1 className="text-3xl font-bold">
            {member?.full_name}
          </h1>
          {member?.nickname && (
            <p className="text-lg text-muted-foreground">&quot;{member.nickname}&quot;</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            {countryDisplay && (
              <span className="text-lg">{countryDisplay}</span>
            )}
            <Badge variant="secondary" className="capitalize">{member?.role}</Badge>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalEvents}</p>
            <p className="text-xs text-muted-foreground">Events</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalDivisions}</p>
            <p className="text-xs text-muted-foreground">Divisions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{bestRank ? `#${bestRank}` : '-'}</p>
            <p className="text-xs text-muted-foreground">Best Rank</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="edit" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Edit Profile
          </TabsTrigger>
        </TabsList>

        {/* Participation History Tab */}
        <TabsContent value="history" className="space-y-4">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(eventGroups).length > 0 ? (
            Object.entries(eventGroups).map(([eventId, group]) => (
              <Card key={eventId}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {group.event?.name || 'Unknown Event'}
                      </CardTitle>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {group.event?.event_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(group.event.event_date)}
                          </span>
                        )}
                        {group.event?.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {group.event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {group.event?.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{entry.division.name}</span>
                            {entry.division.round_type && (
                              <Badge variant="outline" className="text-xs">
                                {roundTypeLabels[entry.division.round_type] || entry.division.round_type}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            {entry.scores.count > 0 && (
                              <span className="flex items-center gap-1">
                                <Trophy className="h-3 w-3" />
                                Avg: {entry.scores.average}
                              </span>
                            )}
                            <span>Registered: {formatDate(entry.registered_at)}</span>
                          </div>
                        </div>
                        {entry.ranking && (
                          <div className="flex-shrink-0 ml-4">
                            <Badge
                              variant="outline"
                              className={`text-sm font-semibold ${getRankBadge(entry.ranking.rank)}`}
                            >
                              <Medal className="h-3 w-3 mr-1" />
                              #{entry.ranking.rank} / {entry.ranking.total}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium">No Participation History</h3>
                <p className="text-muted-foreground mt-1">
                  Register for events to start building your history
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Edit Profile Tab */}
        <TabsContent value="edit">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your name, nickname, and country
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Your full name"
                    required
                    minLength={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input
                    id="nickname"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    placeholder="Stage name or nickname"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be displayed on leaderboards and in greetings
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">
                    Country {countryFlag && <span className="ml-1">{countryFlag}</span>}
                  </Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="Your country (e.g. Malaysia, Japan, USA)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={member?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed. Contact an admin if needed.
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/')}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
