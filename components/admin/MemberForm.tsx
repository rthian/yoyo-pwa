/**
 * Member Form Component
 * Handles create and edit for members
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { memberSchema, type MemberFormData } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Member } from '@/lib/types/database'

interface MemberFormProps {
  member?: Member
}

export default function MemberForm({ member }: MemberFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      email: member?.email || '',
      full_name: member?.full_name || '',
      nickname: member?.nickname || '',
      role: member?.role || 'member',
      country: member?.country || '',
      is_active: member?.is_active ?? true,
    },
  })

  const role = watch('role')
  const isActive = watch('is_active')

  const onSubmit = async (data: MemberFormData) => {
    setLoading(true)

    try {
      if (member) {
        // Update existing member via API
        const response = await fetch(`/api/members/${member.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update member')
        }

        toast.success('Member updated successfully')
        router.push(`/admin/members/${member.id}`)
      } else {
        // Create new member via API (requires auth user creation)
        if (!password || password.length < 6) {
          toast.error('Password must be at least 6 characters')
          setLoading(false)
          return
        }

        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, password }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create member')
        }

        toast.success('Member created successfully')
        router.push(`/admin/members/${result.member.id}`)
      }

      router.refresh()
    } catch (error) {
      console.error('Error saving member:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save member')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            placeholder="John Doe"
            {...register('full_name')}
          />
          {errors.full_name && (
            <p className="text-sm text-destructive">{errors.full_name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            placeholder="Johnny"
            {...register('nickname')}
          />
          {errors.nickname && (
            <p className="text-sm text-destructive">{errors.nickname.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          placeholder="john@example.com"
          disabled={!!member}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
        {member && (
          <p className="text-sm text-muted-foreground">
            Email cannot be changed after creation
          </p>
        )}
      </div>

      {!member && (
        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            The member will use this password to log in
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role">Role *</Label>
          <Select
            value={role}
            onValueChange={(value) => setValue('role', value as MemberFormData['role'])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member (Participant)</SelectItem>
              <SelectItem value="judge">Judge</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
            </SelectContent>
          </Select>
          {errors.role && (
            <p className="text-sm text-destructive">{errors.role.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            placeholder="United States"
            {...register('country')}
          />
          {errors.country && (
            <p className="text-sm text-destructive">{errors.country.message}</p>
          )}
        </div>
      </div>

      {role === 'admin' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">
            Administrators have full access to the system, including managing other users.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="is_active" className="text-base">Active Account</Label>
          <p className="text-sm text-muted-foreground">
            Inactive accounts cannot log in or participate in events
          </p>
        </div>
        <Switch
          id="is_active"
          checked={isActive}
          onCheckedChange={(checked) => setValue('is_active', checked)}
        />
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : member ? (
            'Update Member'
          ) : (
            'Create Member'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
