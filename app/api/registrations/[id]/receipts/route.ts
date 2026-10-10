/**
 * Prompt 20: member receipt list + signed upload for a registration.
 */
import { NextResponse } from 'next/server'
import { getAuthedAdminClient } from '@/lib/auth/request'
import {
  getRegistrationForAccount,
  listReceipts,
  RECEIPT_BUCKET,
  signReceiptUpload,
} from '@/lib/payments/receipts'
import { receiptUploadSchema } from '@/lib/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error
    const { id: registrationId } = await params

    const reg = await getRegistrationForAccount(
      auth.supabaseAdmin,
      registrationId,
      auth.user.id
    )
    const receipts = await listReceipts(auth.supabaseAdmin, registrationId)

    const withUrls = await Promise.all(
      receipts.slice(0, 5).map(async (r) => {
        const { data } = await auth.supabaseAdmin.storage
          .from(RECEIPT_BUCKET)
          .createSignedUrl(r.storage_path, 60 * 30)
        return { ...r, signed_url: data?.signedUrl ?? null }
      })
    )

    return NextResponse.json({
      registration: {
        id: reg.id,
        payment_status: reg.payment_status,
        event: reg.event,
      },
      receipts: withUrls,
    })
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500
    console.error('[GET receipts]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: status === 403 || status === 404 || status === 400 ? status : 500 }
    )
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error
    const { id: registrationId } = await params
    const body = await request.json()
    const parsed = receiptUploadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = await signReceiptUpload(auth.supabaseAdmin, {
      accountId: auth.user.id,
      registrationId,
      filename: parsed.data.filename,
      mimeType: parsed.data.mime_type,
      byteSize: parsed.data.byte_size,
    })

    return NextResponse.json({
      receipt: result.receipt,
      signedUrl: result.signed.signedUrl,
      token: result.signed.token,
      path: result.signed.path,
    })
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500
    console.error('[POST receipts]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: status === 403 || status === 404 || status === 400 ? status : 500 }
    )
  }
}
