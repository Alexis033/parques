import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import {
  type EngineState,
  type GameRow,
  type Player,
  createInitialState,
  handleRoll,
  handleExit,
  handleMove,
  handleEndTurn,
  handleSoplar,
  handleHeartbeat,
  handleDisconnect,
  handleRematch,
} from './game-handler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

interface GameActionPayload {
  action: string;
  gameId?: string;
  roomId?: string;
  tokenId?: string;
  squares?: number;
  tokenA?: string;
  tokenB?: string;
  squaresA?: number;
  squaresB?: number;
  targetTokenId?: string;
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const payload: GameActionPayload = await req.json();
  const { action } = payload;

  try {
    switch (action) {
      case 'start-game':
        return await handleStartGame(payload);
      case 'roll-dice':
        return await handleGameAction(payload, handleRoll);
      case 'exit-token':
        return await handleGameAction(payload, (state) => handleExit(state, payload.tokenId!));
      case 'move-token':
        return await handleGameAction(payload, (state) => handleMove(state, payload.tokenId!, payload.squares!));
      case 'end-turn':
        return await handleGameAction(payload, handleEndTurn);
      case 'soplar':
        return await handleGameAction(payload, (state) => handleSoplar(state, payload.targetTokenId!));
      case 'heartbeat':
        return await handleHeartbeatAction(payload);
      case 'disconnect':
        return await handleDisconnectAction(payload);
      case 'rematch':
        return await handleRematchAction(payload);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleStartGame(payload: GameActionPayload): Promise<Response> {
  const { roomId } = payload;
  if (!roomId) {
    return new Response(JSON.stringify({ error: 'roomId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: roomData, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();
  if (roomError || !roomData) {
    return new Response(JSON.stringify({ error: 'Room not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const gameId = crypto.randomUUID();
  const initialState = createInitialState(gameId, roomId, roomData.players, roomData.house_rules);

  const { error: insertError } = await supabase.from('games').insert({
    id: gameId,
    room_id: roomId,
    state: initialState,
    version: 1,
  });
  if (insertError) throw insertError;

  await supabase.from('rooms').update({ status: 'PLAYING' }).eq('id', roomId);

  await broadcastGameState(roomId, initialState, 1);

  return new Response(JSON.stringify({ gameId, state: initialState, version: 1 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGameAction(
  payload: GameActionPayload,
  apply: (state: EngineState) => EngineState,
): Promise<Response> {
  const { gameId } = payload;
  if (!gameId) {
    return new Response(JSON.stringify({ error: 'gameId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch current game with optimistic concurrency
  const { data: gameData, error: fetchError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();
  if (fetchError || !gameData) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const game = gameData as unknown as GameRow;
  const currentState = game.state;

  // Apply the action
  const newState = apply(currentState);

  // If state didn't change (invalid action), reject
  if (newState === currentState) {
    return new Response(JSON.stringify({ error: 'Invalid action for current state', state: currentState }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const newVersion = game.version + 1;

  // Atomic update with version check
  const { error: updateError } = await supabase
    .from('games')
    .update({ state: newState, version: newVersion })
    .eq('id', gameId)
    .eq('version', game.version);
  if (updateError) {
    return new Response(JSON.stringify({ error: 'Conflict: stale version, retry' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Broadcast via real-time
  await broadcastGameState(game.room_id, newState, newVersion);

  return new Response(JSON.stringify({ state: newState, version: newVersion }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function broadcastGameState(roomId: string, state: EngineState, version: number): Promise<void> {
  await supabase.channel(`game:${roomId}`).send({
    type: 'broadcast',
    event: 'state_update',
    payload: { state, version },
  });
}

async function handleHeartbeatAction(payload: GameActionPayload): Promise<Response> {
  const { roomId, playerId } = payload;
  if (!roomId || !playerId) {
    return new Response(JSON.stringify({ error: 'roomId and playerId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch the latest game for this room
  const { data: gameData, error: fetchError } = await supabase
    .from('games')
    .select('*')
    .eq('room_id', roomId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !gameData) {
    return new Response(JSON.stringify({ error: 'No active game found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const game = gameData as unknown as GameRow;
  const currentState = game.state;

  // Check all players for heartbeat timeout (60s)
  let updatedState = structuredClone(currentState);
  const now = Date.now();
  let stateChanged = false;

  for (let i = 0; i < updatedState.players.length; i++) {
    const p = updatedState.players[i];
    if (p.id === playerId) {
      // This player is sending heartbeat — mark connected
      updatedState.players[i] = { ...p, isConnected: true, lastHeartbeat: now };
      stateChanged = true;
    } else if (p.isConnected && p.lastHeartbeat && (now - p.lastHeartbeat) > 60000) {
      // Other player hasn't sent heartbeat in 60s — mark disconnected
      updatedState.players[i] = { ...p, isConnected: false };
      stateChanged = true;
    }
  }

  if (!stateChanged) {
    return new Response(JSON.stringify({ ok: true, state: updatedState, version: game.version }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only increment version if state actually changed
  const newVersion = game.version + 1;
  const { error: updateError } = await supabase
    .from('games')
    .update({ state: updatedState, version: newVersion })
    .eq('id', game.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update connection state' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await broadcastGameState(roomId, updatedState, newVersion);

  return new Response(JSON.stringify({ ok: true, state: updatedState, version: newVersion }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleDisconnectAction(payload: GameActionPayload): Promise<Response> {
  const { roomId, playerId } = payload;
  if (!roomId || !playerId) {
    return new Response(JSON.stringify({ error: 'roomId and playerId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: gameData, error: fetchError } = await supabase
    .from('games')
    .select('*')
    .eq('room_id', roomId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !gameData) {
    return new Response(JSON.stringify({ error: 'No active game found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const game = gameData as unknown as GameRow;
  const currentState = game.state;
  const updatedState = handleDisconnect(currentState, playerId);

  if (updatedState === currentState) {
    return new Response(JSON.stringify({ ok: true, state: updatedState, version: game.version }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const newVersion = game.version + 1;
  const { error: updateError } = await supabase
    .from('games')
    .update({ state: updatedState, version: newVersion })
    .eq('id', game.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update connection state' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await broadcastGameState(roomId, updatedState, newVersion);

  return new Response(JSON.stringify({ ok: true, state: updatedState, version: newVersion }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleRematchAction(payload: GameActionPayload): Promise<Response> {
  const { roomId } = payload;
  if (!roomId) {
    return new Response(JSON.stringify({ error: 'roomId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get the latest game for the room to extract players and house rules
  const { data: gameData, error: fetchError } = await supabase
    .from('games')
    .select('*')
    .eq('room_id', roomId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !gameData) {
    return new Response(JSON.stringify({ error: 'No game found for this room' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const game = gameData as unknown as GameRow;
  const currentState = game.state;

  // Also fetch room data for the latest player list
  const { data: roomData } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (!roomData) {
    return new Response(JSON.stringify({ error: 'Room not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const newGameId = crypto.randomUUID();
  const players = roomData.players as Player[];
  const initialState = createInitialState(newGameId, roomId, players, currentState.houseRules);

  const { error: insertError } = await supabase.from('games').insert({
    id: newGameId,
    room_id: roomId,
    state: initialState,
    version: 1,
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: 'Failed to create rematch' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await broadcastGameState(roomId, initialState, 1);

  return new Response(JSON.stringify({ gameId: newGameId, state: initialState, version: 1 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(handleRequest);
