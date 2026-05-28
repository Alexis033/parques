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
