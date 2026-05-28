# Delta for Room Management

## MODIFIED Requirements

### Requirement: Join room sends clientId

The client-side `joinRoom` service MUST include the localStorage `clientId` value in the player metadata sent to the server.
(Previously: joinRoom sent player id, color, name, isHost, isConnected without clientId.)

#### Scenario: Join includes clientId

- GIVEN a player with a `clientId` in localStorage
- WHEN `joinRoom(roomId)` is called
- THEN the Player object sent includes a `clientId` field

### Requirement: Server deduplicates by clientId

The DB RPC `join_room_with_dedup` MUST check the room's `players` JSONB array for an existing entry with matching `clientId`. If found, it replaces that entry with the new player data instead of appending.
(Previously: The server appended new players unconditionally, allowing stale entries to accumulate. Decision: DB RPC chosen over Edge Function for atomicity.)

#### Scenario: Rejoin replaces stale entry

- GIVEN a room with player entry `{id: "old-id", clientId: "abc-123"}` and a rejoin request with `clientId: "abc-123"` and a new user id
- WHEN `join_room_with_dedup` is called
- THEN the old entry is replaced with the new player data
- AND the players array length stays the same

#### Scenario: Fresh join appends normally

- GIVEN a room with existing players and a join request with an unseen `clientId`
- WHEN `join_room_with_dedup` is called
- THEN the player is appended as a new entry
- AND the players array length increases by one

## ADDED Requirements

### Requirement: listRooms filters stale rooms

`listRooms` SHOULD filter out rooms with `updated_at` older than 4 hours to hide stale WAITING rooms from the lobby list.

#### Scenario: Stale rooms excluded from listing

- GIVEN a WAITING room with `updated_at` older than 4h
- WHEN `listRooms()` is called
- THEN that room is excluded from results
