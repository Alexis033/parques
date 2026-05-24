# Game Results Specification

## Purpose

This specification defines the behavior for displaying game results when a player wins, including rankings, rematch functionality, and proper game state management.

## Requirements

### Requirement: Display Results Modal on Win Condition

When a player reaches the win condition (all 4 tokens crowned), the system MUST show a results modal displaying game completion information.

#### Scenario: Player wins by crowning final token
- GIVEN a player has 3 tokens crowned and makes a move that crowns their 4th token
- WHEN the move is processed and win condition is detected
- THEN the system MUST display a results modal
- AND the modal MUST overlay the game interface
- AND the modal MUST remain visible until user action

#### Scenario: Results modal shows correct rankings
- GIVEN a game has ended with players finishing in order: Player A (1st), Player B (2nd), Player C (3rd), Player D (4th)
- WHEN the results modal is displayed
- THEN the modal MUST show rankings in order: 1st: Player A, 2nd: Player B, 3rd: Player C, 4th: Player D
- AND each player's position MUST be clearly indicated

#### Scenario: Results modal shows token counts
- GIVEN a finished game where Player A has 4 crowned tokens, Player B has 2, Player C has 3, Player D has 1
- WHEN the results modal is displayed
- THEN the modal MUST show each player's crowned token count alongside their name
- AND the counts MUST be accurate to the final game state

#### Scenario: Results modal shows progress information
- GIVEN a finished game where Player A has 1 step remaining, Player B has 5 steps, Player C has 2 steps, Player D has 0 steps
- WHEN the results modal is displayed
- THEN the modal MUST show each player's remaining steps to completion
- AND steps remaining MUST be calculated based on current token positions

### Requirement: Provide Rematch Functionality

The results modal MUST offer a "Rematch" button that creates a new game with the same players in the same room.

#### Scenario: Rematch button creates new game
- GIVEN a game has ended and the results modal is displayed
- WHEN the user clicks the "Rematch" button
- THEN the system MUST create a new game instance in the same room
- AND the new game MUST include all players from the previous game
- AND the new game MUST start with all tokens at starting positions
- AND the turn order MUST be preserved or randomized per game rules

#### Scenario: Rematch resets game state
- GIVEN a rematch is initiated after a completed game
- WHEN the new game starts
- THEN all game state variables MUST be reset to initial values
- AND move history MUST be cleared
- AND win conditions MUST be recalculated from scratch

### Requirement: Provide Lobby Navigation

The results modal MUST offer a "Back to Lobby" button that returns players to the main lobby.

#### Scenario: Back to Lobby navigates correctly
- GIVEN a game has ended and the results modal is displayed
- WHEN the user clicks the "Back to Lobby" button
- THEN the system MUST navigate the user to the lobby page
- AND the user MUST leave the current game room
- AND the room MUST update its active player list accordingly

### Requirement: Update Room State on Game Completion

When a game ends, the system MUST mark the game state as COMPLETED in the room.

#### Scenario: Room state reflects completed game
- GIVEN a game has ended with a winner
- WHEN the win condition is processed
- THEN the system MUST update the room's game state to COMPLETED
- AND the room MUST store the final rankings
- AND the room MUST store timestamp of completion
- AND the room MUST retain player information for rematch functionality

## Edge Cases

### Scenario: Player disconnects before seeing results
- GIVEN a game has ended and results are ready to be displayed
- WHEN a player disconnects before the results modal appears
- THEN the system MUST still store the final game state and rankings
- AND upon reconnection, if the player returns to the same room, they MUST see the results modal
- AND the results MUST show the correct final state from when they disconnected

### Scenario: All but one player leaves after game ends
- GIVEN a game has ended and results modal is displayed
- WHEN three players leave the room (navigate away or disconnect)
- WHEN the remaining player clicks "Rematch"
- THEN the system MUST wait for players to join before starting the new game
- AND the system MUST allow new players to join the room for the rematch
- AND if original players return, they MUST be able to participate in the rematch


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


# Chat Specification

## Purpose

This specification defines the behavior for real-time chat functionality within game rooms, including messaging, system notifications, and message persistence.

## Requirements

### Requirement: Messages Table Structure

The system MUST provide a `messages` table with the specified schema for storing chat messages.

#### Scenario: Messages table has correct columns
- GIVEN the database schema is examined
- WHEN checking the `messages` table structure
- THEN the table MUST have columns: `id` (primary key), `room_id` (foreign key), `player_id` (foreign key), `display_name` (text), `content` (text), `created_at` (timestamp)
- AND the `id` column MUST be auto-incrementing or UUID
- AND the `room_id` MUST reference the rooms table
- AND the `player_id` MUST reference the players table
- AND the `created_at` column MUST default to current timestamp

#### Scenario: Messages table supports indexing
- GIVEN the messages table exists
- WHEN querying messages for a room
- THEN the system MUST efficiently retrieve messages by `room_id`
- AND the system MUST efficiently retrieve recent messages by `created_at`
- AND appropriate indexes SHOULD exist on `room_id` and `created_at` for performance

### Requirement: Send Messages to Current Room

Players MUST be able to send messages to the current room they are in.

#### Scenario: Player sends message to room
- GIVEN a player is connected to a game room with roomId `abc123`
- WHEN the player types a message and clicks send
- THEN the system MUST create a new record in the `messages` table
- AND the record MUST have `room_id` = `abc123`
- AND the record MUST have `player_id` = the sender's ID
- AND the record MUST have `display_name` = the sender's display name
- AND the record MUST have `content` = the message text
- AND the record MUST have `created_at` = timestamp of sending

#### Scenario: Message appears in real-time for all players
- GIVEN two players are connected to the same room
- WHEN player A sends a message
- THEN player B MUST receive the message via Realtime subscription within reasonable time
- AND the message MUST appear in player B's chat interface
- AND the message MUST show correct sender name and timestamp
- AND the message MUST NOT require page refresh to appear

### Requirement: Real-time Message Display

Messages MUST appear in real-time for all players in the room via Realtime subscription.

#### Scenario: Chat component subscribes to messages
- GIVEN the chat component is mounted in a game room
- WHEN the component initializes
- THEN it MUST establish a Realtime subscription to the `messages` table
- AND the subscription MUST filter by `room_id` = current room
- AND the subscription MUST listen for INSERT events
- AND the subscription MUST handle new messages by adding them to the message list

#### Scenario: Message ordering is correct
- GIVEN multiple messages are sent in sequence
- WHEN messages are received via Realtime
- THEN messages MUST be displayed in chronological order by `created_at`
- AND newer messages MUST appear at the bottom of the chat history
- AND the chat interface MUST automatically scroll to show new messages

### Requirement: Chat Component UI

The chat component MUST have: text input with send button, scrollable message history.

#### Scenario: Chat component renders input and button
- GIVEN the chat component is rendered
- WHEN viewing the component
- THEN it MUST show a text input field for message composition
- AND it MUST show a send button next to or below the input
- AND the input field MUST accept text input
- AND the send button MUST be clickable
- AND clicking the send button MUST trigger message sending

#### Scenario: Chat component shows scrollable history
- GIVEN the chat component has received multiple messages
- WHEN the message history exceeds the visible area
- THEN the chat component MUST show a scrollable container
- AND older messages MUST remain accessible via scrolling
- AND the scroll position SHOULD automatically follow new messages when user is scrolled to bottom
- AND manual scrolling upwards SHOULD prevent auto-scroll to allow reading history

### Requirement: System Messages

The system MUST auto-generate system messages for key game events.

#### Scenario: Join system message
- GIVEN a player joins a game room
- WHEN the player's connection is established and they are added to the room
- THEN the system MUST automatically create a system message
- AND the message content MUST be "`[PlayerName] joined the game`"
- AND the message MUST have a special type or marking to distinguish it from user messages
- AND the message MUST appear in the chat for all players in the room
- AND the message MUST NOT be attributable to any specific player_id

#### Scenario: Win system message
- GIVEN a player wins the game
- WHEN the win condition is processed and results are calculated
- THEN the system MUST automatically create a system message
- AND the message content MUST be "`[PlayerName] won the game!`"
- AND the message MUST be sent to all players in the room
- AND the message MUST appear in the chat interface
- AND the message SHOULD use distinctive styling (e.g., different color, bold text)

#### Scenario: Game start system message
- GIVEN a game starts (all players ready, first turn begins)
- WHEN the game transitions from lobby to active gameplay
- THEN the system MUST automatically create a system message
- AND the message content MUST be "`Game started`"
- AND the message MUST be sent to all players in the room
- AND the message MUST appear in the chat interface

## Edge Cases

### Scenario: Empty message handling
- GIVEN a player clicks send with an empty text input
- WHEN the send action is triggered
- THEN the system MUST NOT create a message record
- AND the system MUST NOT send anything via Realtime
- AND the input field MUST remain empty
- AND no error SHOULD be shown to the user (silent ignore is acceptable)
- AND the send button SHOULD be disabled when input is empty (preferred)

### Scenario: Long message handling
- GIVEN a player types a message exceeding reasonable length (e.g., 500+ characters)
- WHEN the player clicks send
- THEN the system MUST either: accept the full message, or truncate to a reasonable limit
- AND if truncated, the system MUST indicate truncation occurred (e.g., with ellipsis)
- AND the message MUST still be sent and displayed in real-time
- AND the chat interface MUST handle long messages without breaking layout

### Scenario: Rapid message sending
- GIVEN a player sends multiple messages in quick succession
- WHEN messages are sent rapidly (e.g., 5 messages in 2 seconds)
- THEN the system MUST process and send each message
- AND messages MUST appear in the correct order for all players
- AND the system MUST NOT drop messages due to rate limiting (unless implemented with user feedback)
- AND the chat interface SHOULD handle rapid influx without performance degradation

### Scenario: Player sends before joining room
- GIVEN a player attempts to send a message before fully joining a room
- WHEN the send action is triggered
- THEN the system MUST either: prevent sending and show error, or buffer until joined
- AND if prevented, the user MUST receive clear feedback about needing to join first
- AND if buffered, the message MUST send automatically upon successful room join
- AND no message SHOULD be lost in this scenario