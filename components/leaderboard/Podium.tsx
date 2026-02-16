/**
 * Podium Component
 * TV-ready top 3 display: Gold, Silver, Bronze
 */
'use client'

import { Trophy, Medal, Award } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface PodiumEntry {
  memberId: string
  memberName: string
  nickname: string | null
  country: string | null
  totalScore: number
  scoreCount: number
  rank: number
}

interface PodiumProps {
  entries: PodiumEntry[]
  className?: string
}

const rankConfig = [
  { rank: 2, label: '2nd', Icon: Medal, className: 'bg-[var(--silver)]/15 border-[var(--silver)]/40 text-[var(--silver)]', order: 'order-2' },
  { rank: 1, label: '1st', Icon: Trophy, className: 'bg-[var(--gold)]/15 border-[var(--gold)]/40 text-[var(--gold)]', order: 'order-1' },
  { rank: 3, label: '3rd', Icon: Award, className: 'bg-[var(--bronze)]/15 border-[var(--bronze)]/40 text-[var(--bronze)]', order: 'order-3' },
]

export default function Podium({ entries, className }: PodiumProps) {
  const top3 = rankConfig.map(({ rank }) => entries.find((e) => e.rank === rank)).filter(Boolean) as PodiumEntry[]

  if (top3.length === 0) return null

  return (
    <div className={cn('grid grid-cols-3 gap-2 items-end', className)}>
      {rankConfig.map(({ rank, label, Icon, className: rankClass, order }) => {
        const entry = top3.find((e) => e.rank === rank)
        if (!entry) return <div key={rank} className={order} />

        return (
          <motion.div
            key={entry.memberId}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn('flex flex-col items-center', order)}
          >
            <div
              className={cn(
                'w-full rounded-xl border p-4 text-center min-h-[100px] flex flex-col justify-center',
                rankClass
              )}
            >
              <Icon className="h-8 w-8 mx-auto mb-1" />
              <p className="text-xs font-medium opacity-90">{label}</p>
              <p className="font-bold truncate mt-1" title={entry.memberName}>
                {entry.memberName}
              </p>
              <p className="text-lg font-bold font-mono tabular-nums mt-1">
                {entry.totalScore.toFixed(2)}
              </p>
              <p className="text-xs opacity-75 mt-0.5">
                {entry.scoreCount} judge{entry.scoreCount !== 1 ? 's' : ''}
              </p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
