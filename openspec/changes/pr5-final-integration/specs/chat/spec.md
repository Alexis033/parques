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