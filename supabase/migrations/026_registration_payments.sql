-- Prompt 20: QR payment config on events + registration receipt uploads.
-- Bucket `registration-receipts` (private) and optional `event-payment-assets` (public QR) in Supabase.
-- Rollback: DROP TABLE registration_receipts; ALTER TABLE events DROP COLUMN payment_*;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_fee_cents INTEGER
    CHECK (registration_fee_cents IS NULL OR registration_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS registration_fee_currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT,
  ADD COLUMN IF NOT EXISTS payment_qr_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_qr_payload TEXT,
  ADD COLUMN IF NOT EXISTS require_paid_before_confirm BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS registration_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  uploaded_by_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  reviewed_by_account_id UUID REFERENCES members(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registration_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_registration_receipts_reg
  ON registration_receipts(registration_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_registration_receipts_pending
  ON registration_receipts(status)
  WHERE status = 'pending';

ALTER TABLE registration_receipts ENABLE ROW LEVEL SECURITY;

-- Service-role / admin client used by APIs; no public policies.
DROP POLICY IF EXISTS registration_receipts_select_own ON registration_receipts;
CREATE POLICY registration_receipts_select_own ON registration_receipts
  FOR SELECT
  USING (
    uploaded_by_account_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );
