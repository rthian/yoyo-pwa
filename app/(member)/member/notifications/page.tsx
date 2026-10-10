import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import NotificationPreferencesForm from '@/components/member/NotificationPreferencesForm'

export default async function MemberNotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which event emails you receive. Live leaderboard updates stay
          in-app.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Opt out per category anytime.</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesForm />
        </CardContent>
      </Card>
    </div>
  )
}
