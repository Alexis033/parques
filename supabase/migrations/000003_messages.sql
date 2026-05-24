-- Migration: Create messages table for real-time chat

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS: anyone can read messages for their room
CREATE POLICY "Anyone can read messages for their room"
  ON messages FOR SELECT
  USING (
    room_id IN (
      SELECT id FROM rooms WHERE rooms.id = messages.room_id
    )
  );

-- RLS: authenticated users can insert messages in their room
CREATE POLICY "Authenticated users can insert messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND room_id IN (
      SELECT id FROM rooms WHERE rooms.id = messages.room_id
    )
    AND (
      -- Either a system message (no player_id required)
      (is_system = true AND player_id IS NULL)
      OR
      -- Or a user message from the authenticated user
      (is_system = false AND player_id = auth.uid())
    )
  );
