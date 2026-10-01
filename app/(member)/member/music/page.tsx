/**
 * Member music upload page — query: divisionId, competitorId
 */
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import MusicUploadPanel from '@/components/member/MusicUploadPanel'

function MusicPageInner() {
  const params = useSearchParams()
  const divisionId = params.get('divisionId')
  const competitorId = params.get('competitorId')

  if (!divisionId || !competitorId) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8 text-sm text-muted-foreground">
        Provide <code>divisionId</code> and <code>competitorId</code> query params.
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-8 space-y-4">
      <h1 className="text-2xl font-bold">Upload music</h1>
      <MusicUploadPanel divisionId={divisionId} competitorId={competitorId} />
    </div>
  )
}

export default function MemberMusicPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <MusicPageInner />
    </Suspense>
  )
}
