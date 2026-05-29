# Delta for Game Engine

## MODIFIED Requirements

### Requirement: Message cleanup on game completion

The system MUST delete all messages for the room when the game phase transitions to `FINISHED`. The DELETE MUST execute BEFORE the room status updates to `COMPLETED`.
(Previously: When the game reached FINISHED, only the room status was updated to COMPLETED. Messages persisted indefinitely.)

#### Scenario: Messages deleted on game finish

- GIVEN a game in `PLAYING` phase with recorded messages in the `messages` table
- WHEN any game action causes the engine state to transition to `phase = 'FINISHED'`
- THEN the Edge Function issues `DELETE FROM messages WHERE room_id = :roomId`
- AND THEN updates the room status to `'COMPLETED'`

#### Scenario: No messages — no-op delete

- GIVEN a game with zero messages in its room
- WHEN the game finishes
- THEN the DELETE affects zero rows (no-op)
- AND the room status still updates to `'COMPLETED'`

#### Scenario: Delete failure prevents room update

- GIVEN a game that just finished
- WHEN the message DELETE fails (DB error)
- THEN the room status MUST NOT be updated to `'COMPLETED'`
- AND the error MUST be propagated to the caller

### Requirement: Client identity in engine state players

The Player type in the Edge Function MUST include a `clientId` field alongside `id`, `color`, `name`, `isHost`, and `isConnected`.
(Previously: Player type did not include clientId.)

#### Scenario: Player created with clientId

- GIVEN a room join with clientId in the payload
- WHEN the player entry is created or replaced in the room players array
- THEN the `clientId` field is stored in that player entry

## ADDED Requirements

### Requirement: Fallback game state subscription

The client MUST subscribe to `postgres_changes` on the `games` table as a fallback channel for game state updates. The client MUST use the broadcast channel as the primary source. When a `postgres_changes` event arrives, the client MUST apply the update only if the payload version is strictly greater than the currently applied version.

#### Scenario: State via broadcast — primary path

- GIVEN the client is subscribed to both broadcast and postgres_changes on `games`
- WHEN a game state update arrives via the broadcast channel
- THEN the client applies the state immediately
- AND the version is recorded as the current version

#### Scenario: Broadcast fails, state arrives via postgres_changes — fallback

- GIVEN the broadcast channel has a connection error or is disconnected
- WHEN a row in the `games` table is updated
- THEN the postgres_changes event fires with the updated game state
- AND the client applies the state if its version > current version

#### Scenario: Both channels deliver — dedup by version

- GIVEN the client applied version 5 from broadcast
- WHEN a postgres_changes event arrives also with version 5
- THEN the client discards the event because version is not greater than current

#### Scenario: Stale event from reconnect — version discards old data

- GIVEN the client has current version 7
- WHEN a late broadcast or postgres_changes event arrives with version 6
- THEN the client discards the event
- AND the existing version 7 state is preserved unchanged
