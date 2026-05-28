-- Migration: 000006_join_room
-- RPC for atomic room join with clientId deduplication
-- Layer 3: Server-side dedup via DB RPC (not Edge Function or client-side)

CREATE OR REPLACE FUNCTION join_room_with_dedup(
  p_room_id UUID,
  p_player JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_room RECORD;
  v_players JSONB;
  v_client_id TEXT;
  v_player_id TEXT;
  v_max_players INT;
  i INT;
BEGIN
  -- Lock room row to prevent race conditions on concurrent joins
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  v_players := v_room.players;
  v_client_id := p_player->>'clientId';
  v_player_id := p_player->>'id';
  v_max_players := v_room.max_players;

  -- Already in room → return as-is
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_players) AS p WHERE p->>'id' = v_player_id) THEN
    RETURN (SELECT row_to_json(r)::jsonb FROM public.rooms r WHERE r.id = p_room_id);
  END IF;

  -- Dedup by clientId: replace stale entry (keep old color and host status)
  IF v_client_id IS NOT NULL AND v_client_id <> '' THEN
    FOR i IN 0..jsonb_array_length(v_players) - 1 LOOP
      IF v_players->i->>'clientId' = v_client_id THEN
        v_players := jsonb_set(
          v_players,
          ARRAY[i::text],
          jsonb_build_object(
            'id', v_player_id,
            'color', v_players->i->>'color',
            'name', p_player->>'name',
            'isHost', (v_players->i->>'isHost')::boolean,
            'isConnected', true,
            'clientId', v_client_id
          )
        );
        UPDATE public.rooms SET players = v_players, updated_at = now() WHERE id = p_room_id;
        RETURN (SELECT row_to_json(r)::jsonb FROM public.rooms r WHERE r.id = p_room_id);
      END IF;
    END LOOP;
  END IF;

  -- Max players check
  IF jsonb_array_length(v_players) >= v_max_players THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  -- Validate color: if requested color is already taken, assign the first available one
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_players) AS p WHERE p->>'color' = p_player->>'color') THEN
    -- Find first unused color in standard order
    DECLARE
      v_color TEXT;
      v_found BOOLEAN;
    BEGIN
      FOR v_color IN SELECT unnest(ARRAY['RED', 'BLUE', 'GREEN', 'YELLOW']) LOOP
        SELECT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_players) AS p WHERE p->>'color' = v_color) INTO v_found;
        IF v_found THEN
          p_player := jsonb_set(p_player, '{color}', to_jsonb(v_color));
          EXIT;
        END IF;
      END LOOP;
      -- If all 4 colors taken, room is full (safety check, should be caught by max_players above)
      IF NOT v_found THEN
        RAISE EXCEPTION 'Room is full';
      END IF;
    END;
  END IF;

  -- Append new player
  v_players := v_players || jsonb_build_array(p_player);
  UPDATE public.rooms SET players = v_players, updated_at = now() WHERE id = p_room_id;

  RETURN (SELECT row_to_json(r)::jsonb FROM public.rooms r WHERE r.id = p_room_id);
END;
$$;
