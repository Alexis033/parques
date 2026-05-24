# Design: PR5 — Final Integration

## Technical Approach

PR5 cierra el MVP con 3 features independientes + 1 bug fix crítico. Orden de implementación: fix broadcast → T30 (reconnection) → T29 (results) → T31 (chat). Cada feature tiene su propio commit y es revertible individualmente.

## Architecture Decisions

### Decision: Broadcast Channel Unification

| Option | Tradeoff |
|--------|----------|
| **Cambiar frontend a `game:roomId`** | Edge Function ya usa `game:roomId`. Solo requiere pasar `roomId` a `subscribeToGame`. Mínimo cambio. |
| Cambiar Edge Function a `game:gameId` | Requiere modificar Edge Function + todas las subscripciones existentes. Más riesgo. |

**Choice**: Cambiar frontend. `GameService.subscribeToGame(gameId)` → `subscribeToGame(roomId)`. Pasar `roomId` desde `startGame`, `loadGame`, y `findGameByRoomId`.

### Decision: Disconnect Detection

| Option | Tradeoff |
|--------|----------|
| **`navigator.sendBeacon` + heartbeat timeout** | Simple, sin dependencias. `sendBeacon` en `beforeunload` llama a Edge Function para marcar disconnect. Heartbeat cada 30s para detectar crashes. |
| Supabase Realtime Presence | Más integrado pero mayor latencia en detección. |
| WebSocket nativo | Overkill para este caso. |

**Choice**: `sendBeacon` on `beforeunload` + Edge Function heartbeat endpoint + timeout check (si no hay heartbeat en 60s = disconnected).

### Decision: Chat Storage

| Option | Tradeoff |
|--------|----------|
| **Direct DB insert + Realtime** | Simple, aprovecha Supabase existente. RLS asegura que solo miembros de la sala puedan insertar. |
| Edge Function para cada mensaje | Más control pero latencia extra innecesaria para chat. |

**Choice**: Direct DB insert con RLS policy (`room_id` = current room AND sender is in room's player list). Realtime subscription en tabla `messages` filtrada por `room_id`.

### Decision: Results Modal

| Option | Tradeoff |
|--------|----------|
| **Componente inline en game.component.ts** | Simple, ya existe el modal básico. Reemplazar con versión completa. |
| Componente separado | Más limpio pero overkill para un modal que solo se muestra al final. |

**Choice**: Reemplazar el modal inline actual (líneas 112-122 de game.component.ts) con uno más completo que muestre rankings via `getRankings()`.

## Data Flow

```
T30 Fix: Broadcast Channel
┌─────────────────────┐     ┌──────────────────────────────┐
│  Edge Function      │────→│  Realtime: game:${roomId}    │
│  broadcastGameState │     └──────────────┬───────────────┘
└─────────────────────┘                    │
                                  ┌────────▼───────────────┐
                                  │  GameService           │
                                  │  subscribeToRoom(roomId)│
                                  └────────────────────────┘

T29: Game Over Flow
EngineState.winner 👉 GameComponent detecta 👉 Results Modal
     │                                              │
     ▼                                              ▼
Edge Function guarda                       Rematch → startGame
rankings en room                           en misma roomId

T31: Chat Flow
Usuario → ChatComponent → supabase.from('messages').insert()
                                 │
                                 ▼
                        Realtime broadcast
                                 │
                                 ▼
                   Todos los players reciben
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/services/game/game.service.ts` | Modify | Fix broadcast channel, add 409 retry, add heartbeat call |
| `src/app/pages/game/game.component.ts` | Modify | Results modal completo, rematch, reconnection flow |
| `src/app/components/chat/chat.component.ts` | Rewrite | Full chat implementation |
| `src/app/components/player-panel/player-panel.component.ts` | Modify | Improved disconnected indicator (greyed out) |
| `supabase/functions/game/index.ts` | Modify | Add heartbeat + disconnect + rematch actions |
| `supabase/functions/game/game-handler.ts` | Modify | Add heartbeat handling, rematch logic |
| `supabase/migrations/000003_messages.sql` | Create | `messages` table with RLS |

## Interfaces / Contracts

```typescript
// Edge Function: new actions
type GameActionType = 'heartbeat' | 'disconnect' | 'rematch' | /* existing */;

// Heartbeat payload
interface HeartbeatPayload {
  action: 'heartbeat';
  roomId: string;
}

// Disconnect payload  
interface DisconnectPayload {
  action: 'disconnect';
  roomId: string;
  playerId: string;
}

// Rematch payload
interface RematchPayload {
  action: 'rematch';
  roomId: string;
}

// Chat message (DB row)
interface MessageRow {
  id: string;
  room_id: string;
  player_id: string | null;  // null for system messages
  display_name: string;
  content: string;
  created_at: string;
  is_system: boolean;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Chat component rendering, retry logic | Vitest, mock Realtime |
| Integration | Broadcast channel subscription | Verify GameService subscribes to correct channel |
| E2E | Full game flow: play → winner → rematch | Playwright |
| Manual | Disconnect/reconnect | Browser DevTools offline mode |

## Migration / Rollout

No migration required for existing data. New `messages` table is additive. Rematch reuses existing rooms table.

## Open Questions

- [ ] ¿Usar la misma roomId para rematch o crear una nueva sala? (Decisión: misma roomId, nuevo game instance)
- [ ] ¿Timeout de heartbeat? 30s intervalo, 60s sin respuesta = disconnected
