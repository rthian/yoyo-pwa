/**
 * Landing Page Component
 * Public-facing landing page for unauthenticated users
 */
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Gavel, Trophy, Users } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🪀</div>
        <h1 className="text-4xl font-bold mb-4">YoYo League</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Event management, judging, and ranking system for competitive yo-yo events
        </p>
        
        <div className="flex gap-4 justify-center flex-wrap">
          <Button asChild size="lg">
            <Link href="/login">
              Sign In
            </Link>
          </Button>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="h-full">
            <CardHeader>
              <Shield className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Admin Portal</CardTitle>
              <CardDescription>
                Manage events, divisions, members, and judges all in one place
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="h-full">
            <CardHeader>
              <Gavel className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Mobile Judging</CardTitle>
              <CardDescription>
                Mobile-optimized interface for judges to score competitors on the go
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Link href="/leaderboards">
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardHeader>
                <Trophy className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Live Leaderboards</CardTitle>
                <CardDescription>
                  Real-time scoring updates with shareable public leaderboard links
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          
          <Card className="h-full">
            <CardHeader>
              <Users className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Member Profiles</CardTitle>
              <CardDescription>
                Track participant history, rankings, and event participation
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>YoYo League — Event Management & Judging</p>
          <p className="text-sm mt-2">Built with Next.js, Supabase, and shadcn/ui</p>
          <p className="text-xs mt-2">© {new Date().getFullYear()} YoYo League. Created by <a href="https://github.com/rthian" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">rthian</a>.</p>
        </div>
      </footer>
    </main>
  )
}
