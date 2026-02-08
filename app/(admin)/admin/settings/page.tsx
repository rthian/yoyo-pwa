/**
 * Admin Settings Page
 * System configuration and preferences
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings, Database, Shield, Bell, Palette } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage system configuration and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              Basic system configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">System Version</p>
                <p className="text-sm text-muted-foreground">Current application version</p>
              </div>
              <Badge variant="outline">v1.0.0</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Environment</p>
                <p className="text-sm text-muted-foreground">Deployment environment</p>
              </div>
              <Badge>{process.env.NODE_ENV || 'development'}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database
            </CardTitle>
            <CardDescription>
              Supabase connection status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Status</p>
                <p className="text-sm text-muted-foreground">Database connection</p>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Provider</p>
                <p className="text-sm text-muted-foreground">Database provider</p>
              </div>
              <Badge variant="outline">Supabase</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              Authentication and access settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Authentication</p>
                <p className="text-sm text-muted-foreground">Auth provider</p>
              </div>
              <Badge variant="outline">Supabase Auth</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Row Level Security</p>
                <p className="text-sm text-muted-foreground">Database RLS status</p>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Enabled
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Real-time Updates</p>
                <p className="text-sm text-muted-foreground">Live score notifications</p>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Enabled
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">System emails</p>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Theme and display settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The application automatically follows your system theme preference.
            Toggle dark mode in your system settings to switch themes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
