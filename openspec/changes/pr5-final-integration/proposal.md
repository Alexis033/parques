# Proposal: PR5 — Final Integration

## Intent

Cerrar el MVP del Parchís Online multijugador. PR1-4 dejaron el juego funcional pero con un bug crítico de Realtime broadcast y sin features de cierre: fin de partida, rematch, reconexión, ni chat.

## Scope

### In Scope
- Fix crítico: unificar canal Realtime entre Edge Function y frontend
- Pantalla de resultados con rankings (1°-4°) y estadísticas
- Rematch: nueva partida con los mismos jugadores
- Heartbeat + detección de disconnect + reconexión automática
- Chat en tiempo real con mensajes de sistema
- Actualizar estado de sala al finalizar la partida

### Out of Scope
- Sonidos / efectos de audio
- Turn timer / timeout automático
- Refactor de la duplicación engine ↔ Edge Function
- Responsive design / mobile layout

## Capabilities

### New Capabilities
- `game-results`: pantalla de resultados, rankings, rematch
- `reconnection`: heartbeat, disconnect detection, auto-reconnect
- `chat`: mensajes en tiempo real por sala

### Modified Capabilities
- None (no existing specs change behavior)

## Approach

1. **Broadcast fix** primero — cambiar `game:gameId` a `game:roomId` en frontend
2. **T29** — Game Over: hook al win-condition, modal de resultados, rematch
3. **T30** — Reconnection: heartbeat endpoint, disconnect trigger, restore subscription
4. **T31** — Chat: migration `messages` table, Edge Function, componente funcional

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/functions/game/index.ts` | Modified | Fix broadcast channel name |
| `src/app/services/game/game.service.ts` | Modified | Fix subscription channel, add retry + reconnect |
| `src/app/pages/game/game.component.ts` | Modified | Results modal, rematch UI, reconnect flow |
| `src/app/components/chat/` | New | Full chat implementation |
| `src/app/components/player-panel/` | Modified | Disconnected indicator |
| `supabase/migrations/` | New | `messages` table |
| `supabase/functions/game/game-handler.ts` | Modified | Heartbeat, disconnect, rematch logic |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Engine duplicado en Edge Function — bugfix requiere sync manual | Medium | Documentar dependencia; considerar shared build post-MVP |
| Last Token Mode sin tests de integración E2E | Medium | Probar manualmente antes de release |
| 409 Conflict sin retry — jugador pierde acción | Medium | Implementar retry con exponential backoff |
| Sin linter — código puede divergir en estilo | Low | Aceptado para MVP, agregar post-MVP |

## Rollback Plan

Por ser PR5 sobre PR1-4 ya estables: revertir commits de PR5 en main. Cada T29/T30/T31 es independiente — si uno falla, se revierte solo ese.

## Dependencies

- Supabase project activo (same as PR1-4)
- Edge Function deployada

## Success Criteria

- [ ] Fix broadcast verificado: movimientos se reflejan sin depender de `postgres_changes`
- [ ] Partida termina con modal de resultados mostrando rankings completos
- [ ] Rematch crea nueva partida con los mismos jugadores en la misma sala
- [ ] Jugadores desconectados se marcan como `isConnected: false`
- [ ] Reconexión restaura suscripción y estado visual correcto
- [ ] Mensajes de chat se envían y reciben en tiempo real
- [ ] Todos los 221 tests existentes siguen pasando
