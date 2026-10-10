/**
 * Member music upload — Prompt 17: competitor selector (can_manage_music).
 * Callers: deep links ?divisionId&competitorId or pick from managed list
 * User: "Start build"
 */
'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MusicUploadPanel from '@/components/member/MusicUploadPanel'
import CompetitorSelector, {
  type SelectableCompetitor,
} from '@/components/member/CompetitorSelector'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { toast } from 'sonner'

function MusicPageInner() {
  const params = useSearchParams()
  const router = useRouter()
  const divisionIdParam = params.get('divisionId') || ''
  const competitorIdParam = params.get('competitorId') || ''

  const [competitors, setCompetitors] = useState<SelectableCompetitor[]>([])
  const [competitorId, setCompetitorId] = useState(competitorIdParam)
  const [divisionId, setDivisionId] = useState(divisionIdParam)
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/member/competitors')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      const list = (data.competitors || []) as SelectableCompetitor[]
      setCompetitors(list)
      setCompetitorId((prev) => {
        if (prev && list.some((c) => c.id === prev && c.link.can_manage_music)) {
          return prev
        }
        if (
          competitorIdParam &&
          list.some(
            (c) => c.id === competitorIdParam && c.link.can_manage_music
          )
        ) {
          return competitorIdParam
        }
        const withMusic = list.find((c) => c.link.can_manage_music)
        return withMusic?.id || ''
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load competitors')
    } finally {
      setReady(true)
    }
  }, [competitorIdParam])

  useEffect(() => {
    load()
  }, [load])

  const musicCapable = competitors.filter((c) => c.link.can_manage_music)

  if (!ready) {
    return <div className="p-8 text-muted-foreground text-sm">Loading…</div>
  }

  if (musicCapable.length === 0) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8 space-y-3 text-sm">
        <h1 className="text-2xl font-bold">Upload music</h1>
        <p className="text-muted-foreground">
          None of your competitors allow music management. Enable “Music” on a
          competitor under{' '}
          <Link href="/member/competitors" className="text-primary underline">
            Competitors
          </Link>
          .
        </p>
      </div>
    )
  }

  const showUpload = Boolean(divisionId && competitorId)

  return (
    <div className="container mx-auto max-w-lg px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload music</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose who you are uploading for, then enter the division id (from
          your registration or organizer).
        </p>
      </div>

      <CompetitorSelector
        competitors={competitors}
        value={competitorId}
        onChange={(id) => {
          setCompetitorId(id)
          const qs = new URLSearchParams()
          if (divisionId) qs.set('divisionId', divisionId)
          qs.set('competitorId', id)
          router.replace(`/member/music?${qs}`)
        }}
        capability="music"
        label="Uploading as"
      />

      <div className="space-y-1.5">
        <Label htmlFor="division-id">Division ID</Label>
        <Input
          id="division-id"
          value={divisionId}
          onChange={(e) => setDivisionId(e.target.value.trim())}
          placeholder="UUID of the division"
        />
      </div>

      {!showUpload ? (
        <Button
          disabled={!divisionId || !competitorId}
          onClick={() => {
            const qs = new URLSearchParams({
              divisionId,
              competitorId,
            })
            router.replace(`/member/music?${qs}`)
          }}
        >
          Continue
        </Button>
      ) : (
        <MusicUploadPanel
          divisionId={divisionId}
          competitorId={competitorId}
        />
      )}
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
