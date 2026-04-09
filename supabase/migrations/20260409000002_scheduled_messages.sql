-- Feature AB-00003: "Send Later" message scheduler
-- Adds scheduled_send_at column to messages table

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_scheduled ON messages (scheduled_send_at)
  WHERE status = 'scheduled';
