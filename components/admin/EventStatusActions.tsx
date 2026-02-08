/**
 * Event Status Actions Component
 * Displays and allows changing event status
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Event, EventStatus } from '@/lib/types/database'

interface EventStatusActionsProps {
  event: Event
}

const statusConfig: Record<EventStatus, { label: string; color: string; nextStates: EventStatus[] }> = {
  draft: {
    label: 'Draft',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    nextStates: ['published', 'cancelled'],
  },
  published: {
    label: 'Published',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    nextStates: ['active', 'draft', 'cancelled'],
  },
  active: {
    label: 'Active',
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    nextStates: ['completed', 'published'],
  },
  completed: {
    label: 'Completed',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    nextStates: ['active'],
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    nextStates: ['draft'],
  },
}

export default function EventStatusActions({ event }: EventStatusActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const currentStatus = statusConfig[event.status]
  const availableTransitions = currentStatus.nextStates

  const handleStatusChange = async (newStatus: EventStatus) => {
    setLoading(true)

    try {
      // Use API route to bypass RLS - send full event data with updated status
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: event.name,
          description: event.description || undefined,
          location: event.location || undefined,
          event_date: event.event_date || undefined,
          status: newStatus,
          ruleset_id: event.ruleset_id || undefined,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to update status')
      }

      toast.success(`Event status changed to ${statusConfig[newStatus].label}`)
      router.refresh()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 w-full">
      <Badge className={`${currentStatus.color} text-sm px-3 py-1`}>
        {currentStatus.label}
      </Badge>
      
      {availableTransitions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Change
                  <ChevronDown className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {availableTransitions.map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => handleStatusChange(status)}
              >
                <Badge className={`${statusConfig[status].color} mr-2`}>
                  {statusConfig[status].label}
                </Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
