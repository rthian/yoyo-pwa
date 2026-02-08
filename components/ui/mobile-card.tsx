/**
 * Mobile Card Components
 * Touch-optimized card layouts for mobile interfaces
 */
'use client'

import { ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface MobileCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  href?: string
  showChevron?: boolean
  disabled?: boolean
}

const MobileCard = forwardRef<HTMLDivElement, MobileCardProps>(
  ({ children, className, onClick, href, showChevron = false, disabled = false }, ref) => {
    const baseClasses = cn(
      // Base styles
      'relative flex items-center gap-3 p-4',
      'bg-card rounded-lg border',
      // Touch target (minimum 44px)
      'min-h-[56px]',
      // Touch feedback
      !disabled && 'active:bg-muted/50 transition-colors',
      // Cursor
      !disabled && (onClick || href) && 'cursor-pointer',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )

    const content = (
      <>
        {children}
        {showChevron && (
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}
      </>
    )

    if (href && !disabled) {
      return (
        <Link href={href} className={baseClasses}>
          {content}
        </Link>
      )
    }

    return (
      <div
        ref={ref}
        className={baseClasses}
        onClick={disabled ? undefined : onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick && !disabled ? 0 : undefined}
      >
        {content}
      </div>
    )
  }
)
MobileCard.displayName = 'MobileCard'

interface MobileCardContentProps {
  children: ReactNode
  className?: string
}

function MobileCardContent({ children, className }: MobileCardContentProps) {
  return (
    <div className={cn('flex-1 min-w-0', className)}>
      {children}
    </div>
  )
}

interface MobileCardIconProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'destructive'
}

function MobileCardIcon({ children, className, variant = 'default' }: MobileCardIconProps) {
  const variantClasses = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    destructive: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div className={cn(
      'flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0',
      variantClasses[variant],
      className
    )}>
      {children}
    </div>
  )
}

interface MobileCardTitleProps {
  children: ReactNode
  className?: string
}

function MobileCardTitle({ children, className }: MobileCardTitleProps) {
  return (
    <p className={cn('font-medium truncate', className)}>
      {children}
    </p>
  )
}

interface MobileCardDescriptionProps {
  children: ReactNode
  className?: string
}

function MobileCardDescription({ children, className }: MobileCardDescriptionProps) {
  return (
    <p className={cn('text-sm text-muted-foreground truncate', className)}>
      {children}
    </p>
  )
}

interface MobileCardBadgeProps {
  children: ReactNode
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive'
  className?: string
}

function MobileCardBadge({ children, variant = 'default', className }: MobileCardBadgeProps) {
  const variantClasses = {
    default: 'bg-primary/10 text-primary',
    secondary: 'bg-muted text-muted-foreground',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    destructive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <span className={cn(
      'px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  )
}

// Skeleton loaders
function MobileCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      'flex items-center gap-3 p-4 bg-card rounded-lg border animate-pulse',
      className
    )}>
      <div className="w-10 h-10 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-3 w-1/2 bg-muted rounded" />
      </div>
    </div>
  )
}

function MobileListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <MobileCardSkeleton key={i} />
      ))}
    </div>
  )
}

export {
  MobileCard,
  MobileCardContent,
  MobileCardIcon,
  MobileCardTitle,
  MobileCardDescription,
  MobileCardBadge,
  MobileCardSkeleton,
  MobileListSkeleton,
}
