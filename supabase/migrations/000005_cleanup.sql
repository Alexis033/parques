-- Migration: 000005_cleanup
-- Auto-cleanup of expired data using pg_cron
-- Purge ALL rooms and stale data older than 24h, no exceptions.

-- 1. Enable pg_cron (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Delete ALL rooms older than 24h regardless of status (WAITING, PLAYING, COMPLETED, CANCELLED)
  -- Games are cascade-deleted by FK, messages are cascade-deleted by FK.
  BEGIN
    DELETE FROM public.rooms
    WHERE updated_at < now() - interval '24 hours';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'cleanup_expired_data: rooms delete failed: %', SQLERRM;
  END;

  -- Delete anonymous users older than 24h, regardless of room status
  BEGIN
    DELETE FROM auth.users
    WHERE is_anonymous = true
      AND last_sign_in_at < now() - interval '1 day';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'cleanup_expired_data: auth.users delete failed: %', SQLERRM;
  END;
END;
$$;

-- 3. Schedule: every hour
SELECT cron.schedule('cleanup-db', '0 * * * *', 'SELECT cleanup_expired_data()');
