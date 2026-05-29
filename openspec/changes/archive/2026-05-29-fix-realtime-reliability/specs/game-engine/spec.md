# Delta for game-engine

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
