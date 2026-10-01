/**
 * Competitor music upload UI (MVP).
 */
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface MusicUploadPanelProps {
  divisionId: string
  competitorId: string
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export default function MusicUploadPanel({
  divisionId,
  competitorId,
}: MusicUploadPanelProps) {
  const [status, setStatus] = useState<string>('missing')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [copyright, setCopyright] = useState(false)
  const [explicit, setExplicit] = useState(false)
  const [usage, setUsage] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/divisions/${divisionId}/music`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      const mine = (data.submissions || []).find(
        (s: { competitor_id: string }) => s.competitor_id === competitorId
      )
      setStatus(mine?.status ?? 'missing')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load music')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisionId, competitorId])

  const onFile = async (file: File | null) => {
    if (!file) return
    if (!copyright || !usage) {
      toast.error('Accept copyright and usage declarations first')
      return
    }
    setUploading(true)
    try {
      const signRes = await fetch(`/api/divisions/${divisionId}/music/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign-upload',
          competitor_id: competitorId,
          filename: file.name,
          mime_type: file.type || 'audio/mpeg',
          byte_size: file.size,
          copyright_declared: copyright,
          explicit_content_declared: explicit,
          usage_declared: usage,
        }),
      })
      const signData = await signRes.json()
      if (!signRes.ok) throw new Error(signData.error || 'Could not sign upload')

      const put = await fetch(signData.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'audio/mpeg',
        },
        body: file,
      })
      if (!put.ok) throw new Error('Upload to storage failed')

      const checksum = await sha256Hex(file)
      const confirmRes = await fetch(`/api/divisions/${divisionId}/music/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          competitor_id: competitorId,
          version_id: signData.version.id,
          checksum_sha256: checksum,
        }),
      })
      const confirmData = await confirmRes.json()
      if (!confirmRes.ok) throw new Error(confirmData.error || 'Confirm failed')

      toast.success('Music uploaded (validation pending)')
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const preview = async () => {
    try {
      const res = await fetch(`/api/divisions/${divisionId}/music/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', competitor_id: competitorId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreviewUrl(data.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading music…
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Competition music</h3>
        <span className="text-sm text-muted-foreground">Status: {status}</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Switch checked={copyright} onCheckedChange={setCopyright} />
          <Label>I declare I have rights to use this track</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={usage} onCheckedChange={setUsage} />
          <Label>I agree to event music usage terms</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={explicit} onCheckedChange={setExplicit} />
          <Label>Track may contain explicit content</Label>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="music-file">Audio file</Label>
        <Input
          id="music-file"
          type="file"
          accept="audio/*"
          disabled={uploading}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={preview} disabled={status === 'missing'}>
          Preview (signed URL)
        </Button>
        {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      {previewUrl && (
        <audio controls src={previewUrl} className="w-full" />
      )}
      <p className="text-xs text-muted-foreground">
        Files stay private. Browser MIME is not trusted for final validation.
      </p>
    </div>
  )
}
