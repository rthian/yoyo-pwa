/**
 * Prompt 20: show QR / instructions + upload payment receipt.
 * Callers: member registrations page
 * Glob: no prior PaymentReceiptPanel
 * Sample: payment_status unpaid → pending after upload
 * User: "merge lets proceed"
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatFeeCents } from '@/lib/payments/receipts'

type EventPay = {
  id: string
  name?: string
  payment_required?: boolean
  registration_fee_cents?: number | null
  registration_fee_currency?: string | null
  payment_instructions?: string | null
  payment_qr_url?: string | null
  payment_qr_payload?: string | null
}

type Receipt = {
  id: string
  status: string
  original_filename: string | null
  rejection_reason: string | null
  signed_url: string | null
  created_at: string
}

interface PaymentReceiptPanelProps {
  registrationId: string
}

export default function PaymentReceiptPanel({
  registrationId,
}: PaymentReceiptPanelProps) {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState('not_required')
  const [event, setEvent] = useState<EventPay | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/registrations/${registrationId}/receipts`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load payment')
      setPaymentStatus(data.registration?.payment_status || 'not_required')
      setEvent(data.registration?.event || null)
      setReceipts(data.receipts || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payment')
    } finally {
      setLoading(false)
    }
  }, [registrationId])

  useEffect(() => {
    load()
  }, [load])

  const onFile = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const signRes = await fetch(
        `/api/registrations/${registrationId}/receipts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sign-upload',
            filename: file.name,
            mime_type: file.type || 'application/octet-stream',
            byte_size: file.size,
          }),
        }
      )
      const signData = await signRes.json()
      if (!signRes.ok) throw new Error(signData.error || 'Could not sign upload')

      const put = await fetch(signData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!put.ok) throw new Error('Upload to storage failed')

      toast.success('Receipt uploaded — awaiting review')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payment…
      </div>
    )
  }

  if (!event?.payment_required && paymentStatus === 'not_required') {
    return null
  }

  const fee = formatFeeCents(
    event?.registration_fee_cents,
    event?.registration_fee_currency || 'SGD'
  )
  const canUpload = ['unpaid', 'pending', 'not_required'].includes(paymentStatus)

  return (
    <div className="rounded-lg border p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Payment</h3>
        <Badge variant="secondary">{paymentStatus}</Badge>
      </div>
      {fee && <p className="text-muted-foreground">Fee: {fee}</p>}
      {event?.payment_instructions && (
        <p className="whitespace-pre-wrap text-muted-foreground">
          {event.payment_instructions}
        </p>
      )}
      {event?.payment_qr_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.payment_qr_url}
          alt="Payment QR code"
          className="max-w-[200px] rounded-md border"
        />
      )}
      {event?.payment_qr_payload && (
        <p className="text-xs font-mono break-all bg-muted p-2 rounded">
          {event.payment_qr_payload}
        </p>
      )}

      {paymentStatus === 'paid' && (
        <p className="text-green-700 dark:text-green-400">Payment confirmed.</p>
      )}
      {paymentStatus === 'waived' && (
        <p className="text-muted-foreground">Payment waived by organizer.</p>
      )}

      {canUpload && paymentStatus !== 'paid' && (
        <div className="space-y-1.5">
          <Label htmlFor={`receipt-${registrationId}`}>Upload receipt</Label>
          <Input
            id={`receipt-${registrationId}`}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={uploading}
            onChange={(e) => onFile(e.target.files?.[0] || null)}
          />
          {uploading && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
            </p>
          )}
        </div>
      )}

      {receipts[0] && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Latest: {receipts[0].original_filename} · {receipts[0].status}
          </p>
          {receipts[0].rejection_reason && (
            <p className="text-destructive">
              Rejected: {receipts[0].rejection_reason}
            </p>
          )}
          {receipts[0].signed_url && (
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <a href={receipts[0].signed_url} target="_blank" rel="noreferrer">
                View receipt
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
