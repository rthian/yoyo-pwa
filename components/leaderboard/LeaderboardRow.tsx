/**
 * LeaderboardRow Component
 * Animated row for rank list (ranks 4+)
 */
'use client'

import { motion } from 'framer-motion'
import { Trophy, Medal, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LeaderboardRowEntry {
  memberId: string
  memberName: string
  nickname: string | null
  country: string | null
  totalScore: number
  scoreCount: number
  rank: number | null
}

interface LeaderboardRowProps {
  entry: LeaderboardRowEntry
  index: number
}

function getRankIcon(rank: number | null) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-[var(--gold)]" />
  if (rank === 2) return <Medal className="h-5 w-5 text-[var(--silver)]" />
  if (rank === 3) return <Award className="h-5 w-5 text-[var(--bronze)]" />
  return null
}

export default function LeaderboardRow({ entry, index }: LeaderboardRowProps) {
  const isTop3 = entry.rank !== null && entry.rank <= 3

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={cn(
        'flex items-center gap-4 p-3 rounded-xl border transition-colors',
        entry.rank === 1 && 'bg-[var(--gold)]/10 dark:bg-[var(--gold)]/15 border-[var(--gold)]/30',
        entry.rank === 2 && 'bg-[var(--silver)]/10 dark:bg-[var(--silver)]/15 border-[var(--silver)]/30',
        entry.rank === 3 && 'bg-[var(--bronze)]/10 dark:bg-[var(--bronze)]/15 border-[var(--bronze)]/30',
        !isTop3 && 'bg-card border-border'
      )}
    >
      <div className="w-8 text-center shrink-0">
        {getRankIcon(entry.rank) || (
          <span className="text-lg font-bold text-muted-foreground tabular-nums">
            {entry.rank}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate tracking-tight">{entry.memberName}</p>
        <p className="text-sm text-muted-foreground truncate">
          {entry.nickname && `"${entry.nickname}" • `}
          {entry.country || 'No country'}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xl font-bold font-mono tabular-nums">
          {entry.totalScore.toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground">
          {entry.scoreCount} judge{entry.scoreCount !== 1 ? 's' : ''}
        </p>
      </div>
    </motion.div>
  )
}
