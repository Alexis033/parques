# Data Cleanup Specification

## Purpose

Automated purging of expired records — chat messages, finished rooms, orphan games, and stale anonymous users — to prevent unbounded DB growth in the fully anonymous MVP.

## Requirements

### Requirement: Edge Function deletes messages on game completion

The system MUST delete all messages for a room when the game engine phase transitions to `FINISHED`.

#### Scenario: Game finishes with messages present

- GIVEN a game in `PLAYING` phase with messages in the `messages` table for that room
- WHEN the game phase transitions to `FINISHED`
- THEN the Edge Function deletes all messages WHERE `room_id` = the game's room_id
- AND THEN the room status updates to `COMPLETED`

#### Scenario: Game finishes with zero messages

- GIVEN a game with no messages in its room
- WHEN the game phase transitions to `FINISHED`
- THEN the DELETE is a no-op (zero rows affected)
- AND the room status updates to `COMPLETED`

### Requirement: pg_cron periodic cleanup RPC

The system MUST run `cleanup_expired_data()` via pg_cron every hour.

#### Scenario: Hourly schedule triggers cleanup

- GIVEN pg_cron is enabled in the Supabase project
- WHEN the cron schedule fires
- THEN `cleanup_expired_data()` executes

### Requirement: Cleanup expired anonymous users

The `cleanup_expired_data()` function MUST delete anonymous `auth.users` WHERE `is_anonymous = true` AND `last_sign_in_at < now() - interval '1 day'` AND the user is NOT a player in any room with status `PLAYING`.

#### Scenario: Stale anonymous user cleaned up

- GIVEN an anonymous auth user with `last_sign_in_at` older than 24h and no active game
- WHEN `cleanup_expired_data()` runs
- THEN the user is deleted from `auth.users`
- AND their profile cascades via FK

#### Scenario: Anonymous user in active game preserved

- GIVEN an anonymous auth user with `last_sign_in_at` older than 24h BUT they are a player in a `PLAYING` room
- WHEN `cleanup_expired_data()` runs
- THEN the user is NOT deleted

### Requirement: Cleanup expired rooms

The `cleanup_expired_data()` function MUST delete rooms WHERE `status IN ('COMPLETED', 'CANCELLED')` AND `updated_at < now() - interval '24h'`, AND rooms WHERE `status = 'WAITING'` AND `updated_at < now() - interval '24h'`.

#### Scenario: Completed room older than 24h

- GIVEN a room with `status = 'COMPLETED'` and `updated_at` older than 24h
- WHEN `cleanup_expired_data()` runs
- THEN the room is deleted
- AND its dependent games and messages cascade via FK

#### Scenario: Waiting room older than 24h

- GIVEN a room with `status = 'WAITING'` and `updated_at` older than 24h
- WHEN `cleanup_expired_data()` runs
- THEN the room is deleted

#### Scenario: Active room preserved

- GIVEN a room with `status = 'PLAYING'` and `updated_at` older than 24h
- WHEN `cleanup_expired_data()` runs
- THEN the room is NOT deleted
