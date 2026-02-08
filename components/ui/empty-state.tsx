/**
 * Empty State Components
 * Display when lists/views have no data
 */
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { 
  Inbox, 
  Search, 
  Calendar, 
  Users, 
  Trophy, 
  ClipboardList,
  WifiOff,
  AlertCircle,
} from 'lucide-react'
import { Button } from './button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  )
}

// Pre-built empty states for common scenarios

export function NoDataState({ message = 'No data available' }: { message?: string }) {
  return (
    <EmptyState
      icon={<Inbox className="h-12 w-12" />}
      title={message}
      description="Data will appear here once available."
    />
  )
}

export function NoSearchResultsState({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={<Search className="h-12 w-12" />}
      title="No results found"
      description={query ? `No results for "${query}". Try a different search term.` : 'Try adjusting your search or filters.'}
    />
  )
}

export function NoEventsState({ onCreateEvent }: { onCreateEvent?: () => void }) {
  return (
    <EmptyState
      icon={<Calendar className="h-12 w-12" />}
      title="No events yet"
      description="Create your first event to get started with the competition."
      action={onCreateEvent ? { label: 'Create Event', onClick: onCreateEvent } : undefined}
    />
  )
}

export function NoMembersState({ onAddMember }: { onAddMember?: () => void }) {
  return (
    <EmptyState
      icon={<Users className="h-12 w-12" />}
      title="No members yet"
      description="Add members to participate in events and competitions."
      action={onAddMember ? { label: 'Add Member', onClick: onAddMember } : undefined}
    />
  )
}

export function NoDivisionsState({ onCreateDivision }: { onCreateDivision?: () => void }) {
  return (
    <EmptyState
      icon={<Trophy className="h-12 w-12" />}
      title="No divisions yet"
      description="Create divisions to organize participants by category."
      action={onCreateDivision ? { label: 'Create Division', onClick: onCreateDivision } : undefined}
    />
  )
}

export function NoScoresState() {
  return (
    <EmptyState
      icon={<ClipboardList className="h-12 w-12" />}
      title="No scores yet"
      description="Scores will appear here as judges submit them."
    />
  )
}

export function NoAssignmentsState({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={<Trophy className="h-12 w-12" />}
      title="No assignments"
      description={message || "You haven't been assigned to any divisions yet."}
    />
  )
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<WifiOff className="h-12 w-12" />}
      title="You're offline"
      description="Some features may be limited. Your work will sync when you're back online."
      action={onRetry ? { label: 'Retry Connection', onClick: onRetry } : undefined}
    />
  )
}

export function ErrorState({ 
  message = 'Something went wrong', 
  onRetry,
}: { 
  message?: string
  onRetry?: () => void 
}) {
  return (
    <EmptyState
      icon={<AlertCircle className="h-12 w-12 text-destructive" />}
      title="Error"
      description={message}
      action={onRetry ? { label: 'Try Again', onClick: onRetry } : undefined}
    />
  )
}
