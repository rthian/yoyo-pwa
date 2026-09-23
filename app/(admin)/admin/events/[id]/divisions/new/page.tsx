/**
 * Create New Division Page
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import DivisionForm from '@/components/admin/DivisionForm'

interface NewDivisionPageProps {
  params: Promise<{ id: string }>
}

export default async function NewDivisionPage({ params }: NewDivisionPageProps) {
  const { id: eventId } = await params
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()

  // Verify event exists
  const { data: event, error } = await supabase
    .from('events')
    .select('id, name')
    .eq('id', eventId)
    .single()

  if (error || !event) {
    notFound()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link 
        href={`/admin/events/${eventId}`}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to {event.name}
      </Link>
      
      <Card>
        <CardHeader>
          <CardTitle>Add Division</CardTitle>
          <CardDescription>
            Create a new competition division for {event.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DivisionForm eventId={eventId} />
        </CardContent>
      </Card>
    </div>
  )
}
