# Client Identity Specification

## Purpose

Persistent localStorage-based client identifier (`clientId`) that survives page refreshes and enables the server to detect when the same anonymous client rejoins a room.

## Requirements

### Requirement: Client generates and persists clientId

The client MUST generate a UUID v4 on first visit, store it in `localStorage` under key `parches_client_id`, and reuse it on subsequent visits.

#### Scenario: First visit generates clientId

- GIVEN a new browser with no existing `clientId` in localStorage
- WHEN the application loads
- THEN a UUID v4 is generated and saved to `localStorage['parches_client_id']`
- AND `window.__ENV__.CLIENT_ID` is set to that value (or the value read from localStorage)

#### Scenario: Return visit reuses clientId

- GIVEN a browser with `localStorage['parches_client_id']` set
- WHEN the application loads
- THEN the existing value is read and used (no new UUID generated)

### Requirement: Client sends clientId on room join

The client MUST include `clientId` in the player metadata when calling `joinRoom`.

#### Scenario: Join with clientId

- GIVEN an authenticated player in a room lobby
- WHEN the player calls `joinRoom(roomId)`
- THEN the request payload includes `clientId` alongside player id, name, and color

### Requirement: Server deduplicates by clientId on join

The Edge Function join handler MUST check the room's `players` JSONB array for an existing entry with the same `clientId`. If found, it MUST replace the old entry with the new player data.

#### Scenario: Replace stale player entry on rejoin

- GIVEN a room with a stale player that has `clientId = "abc-123"` and a new player that sends the same `clientId`
- WHEN the join handler processes the request
- THEN the old player entry is replaced with the new player data (id, name, color)
- AND no duplicate entry is created

#### Scenario: Fresh join with new clientId

- GIVEN a room with existing players
- WHEN a player with a new (unseen) `clientId` joins
- THEN the player is appended as a new entry (standard join behavior)

### Requirement: Session restore with clientId

If the Supabase session is lost on page refresh, the clientId SHOULD enable re-identification when the client re-authenticates and rejoins.

#### Scenario: Re-identification after session loss

- GIVEN a player who lost their Supabase session (e.g., anonymous session expired)
- WHEN they re-authenticate and join a room with the same `clientId`
- THEN the server identifies them as the same player and replaces their old entry
