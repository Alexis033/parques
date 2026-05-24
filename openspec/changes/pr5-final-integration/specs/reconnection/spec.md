# Reconnection Specification

## Purpose

This specification defines the behavior for handling player disconnections and reconnections, including heartbeat mechanisms, disconnect detection, and automatic reconnection with state restoration.

## Requirements

### Requirement: Unified Broadcast Channel

The system MUST use a unified Realtime broadcast channel format `game:${roomId}` for both Edge Function and frontend communications.

#### Scenario: Edge Function uses correct channel
- GIVEN the Edge Function is processing game events
- WHEN broadcasting game state updates
- THEN the Edge Function MUST use the channel `game:${roomId}`
- AND the Edge Function MUST NOT use `game:gameId` or any other channel format
- AND all clients subscribed to `game:${roomId}` MUST receive the updates

#### Scenario: Frontend uses correct channel
- GIVEN the frontend is subscribing to game updates
- WHEN establishing Realtime subscriptions
- THEN the frontend MUST subscribe to the channel `game:${roomId}`
- AND the frontend MUST NOT subscribe to `game:gameId` or any other channel format
- AND the frontend MUST receive all game state updates broadcasted by the Edge Function

### Requirement: Heartbeat Mechanism

The system MUST implement a periodic heartbeat from each client to update connection status.

#### Scenario: Client sends periodic heartbeat
- GIVEN a player is connected to a game room
- WHEN the client has been connected for more than the heartbeat interval
- THEN the client MUST send a ping to the heartbeat endpoint
- AND the ping MUST include the player's ID and room ID
- AND the heartbeat interval MUST be configurable but reasonable (e.g., 30 seconds)

#### Scenario: Server updates connection status
- GIVEN a heartbeat ping is received from a player
- WHEN the Edge Function processes the heartbeat
- THEN the system MUST update the player's `isConnected` field to `true`
- AND the system MUST update the timestamp of last heartbeat
- AND the update MUST be persisted to the room's player data

### Requirement: Disconnect Detection

The system MUST detect when a player disconnects and mark them as disconnected within a reasonable time.

#### Scenario: Browser close detection
- GIVEN a player is actively connected to a game room
- WHEN the player closes their browser tab or window
- THEN the system MUST detect the disconnection within the heartbeat timeout period
- AND the system MUST set the player's `isConnected` field to `false`
- AND the system MUST persist this change to the room's player data

#### Scenario: Navigation away detection
- GIVEN a player is actively connected to a game room
- WHEN the player navigates away from the game page (e.g., to lobby or another site)
- THEN the system MUST detect the disconnection within the heartbeat timeout period
- AND the system MUST set the player's `isConnected` field to `false`
- AND the system MUST persist this change to the room's player data

### Requirement: Automatic Reconnection

When a player returns to the game page, the system MUST restore Realtime subscriptions and sync full game state.

#### Scenario: Reconnection restores subscriptions
- GIVEN a player was previously connected to a room and got disconnected
- WHEN the player navigates back to `/game/:roomId`
- THEN the frontend MUST establish a new Realtime subscription to `game:${roomId}`
- AND the subscription MUST be active before any game state sync
- AND the player MUST receive subsequent game state updates

#### Scenario: Reconnection syncs full game state
- GIVEN a player reconnects to a room where a game is in progress
- WHEN the Realtime subscription is established
- THEN the system MUST fetch and sync the complete current game state
- AND the synced state MUST include: player positions, token states, turn information, game phase
- AND the local game state MUST match the server state after sync
- AND the player MUST be able to see the correct game state immediately

### Requirement: Visual Disconnection Indicator

The player panel MUST show a visual indicator for disconnected players.

#### Scenario: Disconnected player shows visual indicator
- GIVEN a player in the room has `isConnected: false`
- WHEN the player panel is rendered
- THEN the player's name or avatar MUST be visually greyed out
- AND the player panel MUST display a "Disconnected" label or indicator
- AND the indicator MUST be clearly distinguishable from connected players
- AND the visual change MUST occur immediately when `isConnected` changes to false

#### Scenario: Reconnected player removes visual indicator
- GIVEN a player was disconnected and showing visual indicator
- WHEN the player reconnects and `isConnected` becomes `true`
- THEN the visual grey-out MUST be removed
- AND the "Disconnected" label MUST disappear
- AND the player panel MUST return to normal appearance
- AND the change MUST occur immediately when `isConnected` changes to true

### Requirement: Automatic Retry on 409 Conflict

409 Conflict responses from the Edge Function MUST trigger automatic retry with exponential backoff.

#### Scenario: 409 Conflict triggers retry
- GIVEN a client sends a request that receives a 409 Conflict response
- WHEN the response is processed by the frontend
- THEN the client MUST automatically retry the request
- AND the retry MUST use exponential backoff (e.g., 100ms, 200ms, 400ms, 800ms...)
- AND the retry MUST have a maximum number of attempts (e.g., 5 attempts)
- AND if all retries fail, the client MUST show an error to the user

#### Scenario: Successful retry after backoff
- GIVEN a client receives a 409 Conflict on first attempt
- WHEN the client waits the backoff period and retries
- AND the second attempt succeeds
- THEN the client MUST consider the request successful
- AND the client MUST reset the backoff timer for future requests
- AND no error should be shown to the user

## Edge Cases

### Scenario: Reconnect after game ended
- GIVEN a player disconnects after a game has ended but before seeing results
- WHEN the player reconnects to the same room
- THEN the system MUST show the results modal with final rankings
- AND the results MUST reflect the game state at the time of disconnection
- AND the rematch functionality MUST work correctly from this state

### Scenario: Reconnect while another player has the turn
- GIVEN a player disconnects while it's another player's turn
- WHEN the player reconnects
- THEN the system MUST show the correct current turn
- AND the player MUST not be able to make moves when it's not their turn
- AND the game state MUST be fully synchronized including turn information

### Scenario: Multiple players disconnect simultaneously
- GIVEN two or more players disconnect at nearly the same time
- WHEN the system processes the disconnections
- THEN each player MUST be marked as `isConnected: false` independently
- AND the room MUST correctly track all disconnected players
- AND when any player reconnects, they MUST see the correct state including other disconnected players