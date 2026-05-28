-- Migration: 000005_cleanup
-- Auto-cleanup of expired data using pg_cron
-- Layer 2: Periodic purge of expired anonymous users, completed/cancelled/waiting rooms

-- 1. Enable pg_cron (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create cleanup function
-- Each DELETE is in its own BEGIN/EXCEPTION subblock so individual failures
-- (e.g., permission issue on auth.users) don't block the rest of the job.
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Subblock 1: Delete anonymous users inactive >24h with no active PLAYING room
  BEGIN
    DELETE FROM auth.users
    WHERE is_anonymous = true
      AND last_sign_in_at < now() - interval '1 day'
      AND id NOT IN (
        SELECT DISTINCT (p->>'id')::uuid
        FROM public.rooms,
        jsonb_array_elements(public.rooms.players) AS p
        WHERE public.rooms.status = 'PLAYING'
      );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'cleanup_expired_data: auth.users delete failed: %', SQLERRM;
  END;

  -- Subblock 2: Delete COMPLETED / CANCELLED rooms older than 24h
  BEGIN
    DELETE FROM public.rooms
    WHERE status IN ('COMPLETED', 'CANCELLED')
      AND updated_at < now() - interval '24 hours';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'cleanup_expired_data: rooms (completed/cancelled) delete failed: %', SQLERRM;
  END;

  -- Subblock 3: Delete WAITING rooms older than 24h
  BEGIN
    DELETE FROM public.rooms
    WHERE status = 'WAITING'
      AND updated_at < now() - interval '24 hours';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'cleanup_expired_data: rooms (waiting) delete failed: %', SQLERRM;
  END;
END;
$$;

-- 3. Schedule: every hour
SELECT cron.schedule('cleanup-db', '0 * * * *', 'SELECT cleanup_expired_data()');
