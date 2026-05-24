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