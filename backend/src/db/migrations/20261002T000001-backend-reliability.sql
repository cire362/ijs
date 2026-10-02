ALTER TABLE applications ADD COLUMN IF NOT EXISTS commission_rate_id INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS commission_rate_percent NUMERIC(6,3);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS commission_base_price NUMERIC(14,2);
CREATE TABLE IF NOT EXISTS file_deletions (
  id SERIAL PRIMARY KEY,
  url VARCHAR(255) NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS file_deletions_next_attempt_at ON file_deletions(next_attempt_at);
CREATE TABLE IF NOT EXISTS event_reminders (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  minutes_before INTEGER NOT NULL DEFAULT 60,
  due_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','cancelled')),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, agent_id, start_at, minutes_before)
);
CREATE INDEX IF NOT EXISTS event_reminders_status_due_at ON event_reminders(status, due_at);
CREATE INDEX IF NOT EXISTS events_start_at ON events(start_at);
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(255) NOT NULL,
  entity_id INTEGER NOT NULL,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS audit_logs_entity_type_entity_id_created_at ON audit_logs(entity_type,entity_id,created_at);
CREATE INDEX IF NOT EXISTS application_chat_messages_application_created ON application_chat_messages(application_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS chat_messages_room_created ON chat_messages(room_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS chat_messages_unread ON chat_messages(room_id) WHERE is_read=false AND is_admin=false;
CREATE INDEX IF NOT EXISTS applications_agent_created ON applications(agent_id,created_at DESC,id DESC);
