/**
 * Edit Division Page
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import DivisionForm from '@/components/admin/DivisionForm'

interface EditDivisionPageProps {
  params: Promise<{ id: string; divisionId: string }>
}

export default async function EditDivisionPage({ params }: EditDivisionPageProps) {
  const { id: eventId, divisionId } = await params
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()

  const { data: division, error } = await supabase
    .from('divisions')
    .select('*')
    .eq('id', divisionId)
    .single()

  if (error || !division) {
    notFound()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link 
        href={`/admin/events/${eventId}/divisions/${divisionId}`}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Division
      </Link>
      
      <Card>
        <CardHeader>
          <CardTitle>Edit Division</CardTitle>
          <CardDescription>
            Update division details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DivisionForm eventId={eventId} division={division} />
        </CardContent>
      </Card>
    </div>
  )
}
