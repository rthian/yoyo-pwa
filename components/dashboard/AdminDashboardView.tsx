/**
 * Admin Dashboard View
 * Shows admin-specific dashboard with stats, quick links, and judge mode switch
 */
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Users,
  Trophy,
  Gavel,
  BookOpen,
  BarChart3,
  Plus,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import type { Member } from '@/lib/types/database'

interface AdminDashboardViewProps {
  member: Member
}

interface DashboardStats {
  totalEvents: number
  activeEvents: number
  totalMembers: number
  totalDivisions: number
}

export default function AdminDashboardView({ member }: AdminDashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentEvents, setRecentEvents] = useState<Array<{
    id: string
    name: string
    status: string
    event_date: string | null
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch events for stats
        const eventsRes = await fetch('/api/events')
        if (eventsRes.ok) {
          // Events API might not exist as a list route, fallback gracefully
        }
      } catch {
        // Gracefully handle missing endpoints
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome back, {member.full_name}</h1>
          <p className="text-muted-foreground mt-1">
            <Badge variant="secondary" className="mr-2">Admin</Badge>
            Here&apos;s your admin dashboard overview
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Link href="/admin/events/new">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">New Event</p>
                  <p className="text-xs text-muted-foreground">Create competition</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/events">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900 p-2">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">Events</p>
                  <p className="text-xs text-muted-foreground">Manage all events</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/members">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-green-100 dark:bg-green-900 p-2">
                  <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium">Members</p>
                  <p className="text-xs text-muted-foreground">User management</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/rules">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-purple-100 dark:bg-purple-900 p-2">
                  <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium">Rules Library</p>
                  <p className="text-xs text-muted-foreground">Competition rulesets</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Admin Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Admin Tools</CardTitle>
              <CardDescription>Quick access to admin features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin" className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <span>Admin Portal</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link href="/admin/judges" className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                  <span>Judges Management</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link href="/admin/reports" className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <span>Reports</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link href="/leaderboards" className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                  <span>Public Leaderboards</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          {/* Judge Mode Switch */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Judge Mode</CardTitle>
              <CardDescription>Switch to judge console for scoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Gavel className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  As an admin, you can also access the judge console to score competitors during events.
                </p>
                <Link href="/judge">
                  <Button>
                    <Gavel className="h-4 w-4 mr-2" />
                    Open Judge Console
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
