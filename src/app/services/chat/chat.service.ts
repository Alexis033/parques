import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import type { ChatMessage } from '../../components/chat/chat-utils';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type { ChatMessage };
export type MessageInsertPayload = RealtimePostgresChangesPayload<ChatMessage>;

/**
 * Lightweight service wrapping messages table operations.
 * ChatComponent manages its own subscription lifecycle via this service.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private supabase = inject(SupabaseService);

  /** Get the messages table reference for building queries. */
  get messages() {
    return this.supabase.client.from('messages');
  }

  /**
   * Send a user message to the chat room.
   * RLS enforces that the player is a member of the room.
   */
  async sendMessage(
    roomId: string,
    playerId: string,
    displayName: string,
    content: string,
  ): Promise<void> {
    const { error } = await this.messages.insert({
      room_id: roomId,
      player_id: playerId,
      display_name: displayName,
      content,
      is_system: false,
    });
    if (error) throw error;
  }

  /**
   * Insert a system message (e.g., player joined, game started, player won).
   * System messages have no player_id.
   */
  async sendSystemMessage(roomId: string, content: string): Promise<void> {
    const { error } = await this.messages.insert({
      room_id: roomId,
      player_id: null,
      display_name: 'System',
      content,
      is_system: true,
    });
    if (error) throw error;
  }
}
