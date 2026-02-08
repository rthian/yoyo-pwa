/**
 * Create New Member Page
 */
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import MemberForm from '@/components/admin/MemberForm'

export default function NewMemberPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link 
        href="/admin/members"
        className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Members
      </Link>
      
      <Card>
        <CardHeader>
          <CardTitle>Add New Member</CardTitle>
          <CardDescription>
            Create a new participant, judge, or administrator account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberForm />
        </CardContent>
      </Card>
    </div>
  )
}
