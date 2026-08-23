-- =====================================================
-- Migration 120: Create webhook_events table for Razorpay audit trail
-- Purpose: Persist every Razorpay webhook delivery so
--   GET /admin/payments/webhooks returns real data and
--   ops can reconcile payments vs gateway.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  gateway VARCHAR(50) NOT NULL DEFAULT 'razorpay',
  event VARCHAR(100) NOT NULL,
  gateway_payment_id VARCHAR(255),
  order_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'received',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_valid BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event ON webhook_events(event);
CREATE INDEX IF NOT EXISTS idx_webhook_events_gateway_payment_id ON webhook_events(gateway_payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id ON webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

COMMIT;
