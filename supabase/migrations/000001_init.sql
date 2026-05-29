CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  house_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'WAITING'
    CHECK (status IN ('WAITING', 'PLAYING', 'COMPLETED', 'CANCELLED')),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  max_players INT NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_games_room_id ON games(room_id);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);
