import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import {
  type EngineState,
  type GameRow,
  createInitialState,
  handleRoll,
  handleExit,
  handleMove,
  handleEndTurn,
  handleSoplar,
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

serve(handleRequest);
