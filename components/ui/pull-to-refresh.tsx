/**
 * Pull to Refresh Component
 * Mobile-friendly refresh gesture for lists
 */
'use client'

import { useState, useRef, ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  className?: string
}

export function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const isPulling = useRef(false)

  const threshold = 80 // pixels to trigger refresh

  const handleTouchStart = (e: React.TouchEvent) => {
    const container = containerRef.current
    if (!container || container.scrollTop > 0) return
    
    startY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return

    const currentY = e.touches[0].clientY
    const distance = currentY - startY.current

    if (distance > 0) {
      // Apply some resistance
      const resistedDistance = Math.min(distance * 0.5, 120)
      setPullDistance(resistedDistance)
    }
  }

  const handleTouchEnd = async () => {
    if (!isPulling.current) return
    isPulling.current = false

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }
    
    setPullDistance(0)
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div 
        className="absolute left-0 right-0 flex justify-center transition-all duration-200 pointer-events-none"
        style={{ 
          top: pullDistance - 40,
          opacity: Math.min(pullDistance / threshold, 1),
        }}
      >
        <div className={`p-2 rounded-full bg-background shadow-lg ${isRefreshing ? 'animate-spin' : ''}`}>
          <RefreshCw 
            className="h-5 w-5 text-muted-foreground"
            style={{
              transform: `rotate(${pullDistance * 3}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content with pull offset */}
      <div 
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}
