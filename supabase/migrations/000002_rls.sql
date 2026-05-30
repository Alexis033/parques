ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Profiles: own profile only
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Rooms: anyone authenticated can list/read
DROP POLICY IF EXISTS "rooms_select_all" ON rooms;
CREATE POLICY "rooms_select_all" ON rooms
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "rooms_insert_auth" ON rooms;
CREATE POLICY "rooms_insert_auth" ON rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Join room: update players array
DROP POLICY IF EXISTS "rooms_update_join" ON rooms;
CREATE POLICY "rooms_update_join" ON rooms
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rooms_delete_host" ON rooms;
CREATE POLICY "rooms_delete_host" ON rooms
  FOR DELETE USING (auth.uid() = host_id);

-- Games: SELECT for participants only (checked via rooms)
DROP POLICY IF EXISTS "games_select_participant" ON games;
CREATE POLICY "games_select_participant" ON games
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM rooms r,
      jsonb_array_elements(r.players) AS p
      WHERE r.id = games.room_id
        AND p->>'id' = auth.uid()::text
    )
  );

-- No INSERT/UPDATE/DELETE policies for games.
-- Edge Function writes with service_role key.
