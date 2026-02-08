/**
 * Share Leaderboard Button Component
 * Generates and displays shareable leaderboard links
 */
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Share2, Copy, Check, QrCode, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ShareLeaderboardButtonProps {
  divisionId: string
  divisionName: string
}

export default function ShareLeaderboardButton({ 
  divisionId, 
  divisionName 
}: ShareLeaderboardButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generateShareLink = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/leaderboard/${divisionId}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: null }), // No expiry for now
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate link')
      }

      const data = await response.json()
      setShareUrl(data.shareUrl)
      toast.success('Share link generated!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate link')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (!shareUrl) return
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share Leaderboard
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Leaderboard</DialogTitle>
          <DialogDescription>
            Generate a public link to share the {divisionName} leaderboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!shareUrl ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Create a shareable link for spectators to view live scores
              </p>
              <Button onClick={generateShareLink} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Generate Share Link
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="shareUrl">Share URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="shareUrl"
                    value={shareUrl}
                    readOnly
                    className="text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <QrCode className="h-4 w-4" />
                  QR Code
                </div>
                <p className="text-xs text-muted-foreground">
                  QR code generation coming soon. Share the link directly for now.
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <Button 
                  variant="outline"
                  onClick={() => window.open(shareUrl, '_blank')}
                >
                  Preview
                </Button>
                <Button 
                  variant="outline"
                  onClick={generateShareLink}
                >
                  Generate New Link
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
