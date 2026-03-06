/**
 * Edit Member Page
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import MemberForm from '@/components/admin/MemberForm'

interface EditMemberPageProps {
  params: Promise<{ id: string }>
}

export default async function EditMemberPage({ params }: EditMemberPageProps) {
  const { id } = await params
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()

  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !member) {
    notFound()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link 
        href={`/admin/members/${id}`}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Member
      </Link>
      
      <Card>
        <CardHeader>
          <CardTitle>Edit Member</CardTitle>
          <CardDescription>
            Update member details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberForm member={member} />
        </CardContent>
      </Card>
    </div>
  )
}
