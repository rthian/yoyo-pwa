/**
 * Judge Dashboard View
 * Shows judge-specific dashboard with assignments and scoring shortcuts
 */
'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Gavel,
  Trophy,
  ArrowRight,
} from 'lucide-react'
import type { Member } from '@/lib/types/database'
import { formatCountryWithFlag } from '@/lib/utils/country-flags'
import JudgeDashboardHeader from '@/components/shared/JudgeDashboardHeader'

interface JudgeDashboardViewProps {
  member: Member
}

export default function JudgeDashboardView({ member }: JudgeDashboardViewProps) {
  const countryDisplay = formatCountryWithFlag(member.country)

  return (
    <>
      <JudgeDashboardHeader />
      <main className="min-h-screen bg-gradient-to-b from-background to-muted">
        <div className="container mx-auto px-4 py-8">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Welcome, Judge {member.full_name}</h1>
            <p className="text-muted-foreground mt-1">
              <Badge variant="secondary" className="mr-2">Judge</Badge>
              {countryDisplay && <span className="mr-2">{countryDisplay} ·</span>}
              Ready to score some amazing freestyles
            </p>
          </div>

          {/* Primary Action */}
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <Gavel className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Judge Console</h2>
                  <p className="text-muted-foreground">
                    Open the scoring interface to judge assigned divisions
                  </p>
                </div>
              </div>
              <Link href="/judge">
                <Button size="lg">
                  <Gavel className="h-5 w-5 mr-2" />
                  Start Judging
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Access</CardTitle>
                <CardDescription>Useful links for judges</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/judge" className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <Gavel className="h-5 w-5 text-muted-foreground" />
                    <span>Judge Console</span>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Profile</CardTitle>
                <CardDescription>Judge information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-3">
                  <div className="rounded-full bg-primary h-12 w-12 flex items-center justify-center text-primary-foreground font-semibold">
                    {member.full_name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium">{member.full_name}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                    {countryDisplay && (
                      <p className="text-sm">{countryDisplay}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  )
}
