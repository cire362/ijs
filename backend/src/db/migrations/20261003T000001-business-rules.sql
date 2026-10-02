ALTER TYPE enum_applications_status ADD VALUE IF NOT EXISTS 'cancelled';
CREATE INDEX IF NOT EXISTS applications_property_client_phone_digits
  ON applications (property_id, (regexp_replace(client_phone, '\D', '', 'g')));
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS notifications_user_unread ON notifications (user_id, created_at DESC) WHERE is_read = false;
