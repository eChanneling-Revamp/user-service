-- Migration: 003_refresh_tokens_cleanup.sql
-- Adds indexes for refresh_tokens and a cleanup function to remove expired tokens

BEGIN;

-- Index to speed up lookups by expiration and active tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(user_id) WHERE revoked = false;

-- Cleanup function to delete expired refresh tokens
CREATE OR REPLACE FUNCTION delete_expired_refresh_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Note: schedule this with pg_cron or run periodically from your app
-- Example pg_cron entry (if pg_cron is available):
-- SELECT cron.schedule('delete-expired-refresh-tokens', '*/30 * * * *', 'SELECT delete_expired_refresh_tokens()');

COMMIT;
