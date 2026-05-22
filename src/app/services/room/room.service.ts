import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from '../auth/auth.service';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Room, Player, HouseRules, GameStatus } from '@parchis/shared';
import { DEFAULT_HOUSE_RULES, COLORS } from '@parchis/shared';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface RoomRow {
  id: string;
  code: string;
  players: Player[];
  house_rules: HouseRules;
  status: GameStatus;
  host_id: string;
  max_players: number;
  created_at: string;
  updated_at: string;
}

function rowToRoom(row: RoomRow): Room {
  return {
    id: row.id,
    code: row.code,
    players: row.players,
    maxPlayers: row.max_players,
    status: row.status,
    houseRules: row.house_rules ?? DEFAULT_HOUSE_RULES,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class RoomService {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private roomsW = signal<Room[]>([]);
  private currentRoomW = signal<Room | null>(null);
  private loadingW = signal(false);

  readonly rooms = this.roomsW.asReadonly();
  readonly currentRoom = this.currentRoomW.asReadonly();
  readonly loading = this.loadingW.asReadonly();

  private roomChannel: ReturnType<SupabaseService['client']['channel']> | null = null;

  async listRooms(): Promise<Room[]> {
    this.loadingW.set(true);
    const { data, error } = await this.supabase.client
      .from('rooms')
      .select('*')
      .in('status', ['WAITING', 'PLAYING'])
      .order('created_at', { ascending: false });
    this.loadingW.set(false);
    if (error) throw error;
    const rooms = (data ?? []).map(rowToRoom);
    this.roomsW.set(rooms);
    return rooms;
  }

  async getRoom(roomId: string): Promise<Room> {
    const { data, error } = await this.supabase.client
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (error) throw error;
    const room = rowToRoom(data);
    this.currentRoomW.set(room);
    return room;
  }

  async createRoom(houseRules: HouseRules = DEFAULT_HOUSE_RULES): Promise<Room> {
    const userId = this.auth.userId;
    if (!userId) throw new Error('Not authenticated');
    const displayName = this.auth.profile()?.display_name ?? `Player_${userId.slice(0, 6)}`;
    const player: Player = {
      id: userId,
      color: COLORS[0],
      name: displayName,
      isHost: true,
      isConnected: true,
    };
    let code = generateRoomCode();
    const { data, error } = await this.supabase.client
      .from('rooms')
      .insert({
        code,
        players: [player],
        house_rules: houseRules,
        status: 'WAITING',
        host_id: userId,
        max_players: 4,
      })
      .select('*')
      .single();
    if (error) throw error;
    const room = rowToRoom(data);
    this.currentRoomW.set(room);
    return room;
  }

  async joinRoom(roomId: string): Promise<Room> {
    const userId = this.auth.userId;
    if (!userId) throw new Error('Not authenticated');
    const displayName = this.auth.profile()?.display_name ?? `Player_${userId.slice(0, 6)}`;
    const { data: roomData, error: fetchError } = await this.supabase.client
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (fetchError) throw fetchError;
    const room = rowToRoom(roomData);
    if (room.players.some((p) => p.id === userId)) {
      this.currentRoomW.set(room);
      return room;
    }
    const nextColor = COLORS[room.players.length];
    const player: Player = {
      id: userId,
      color: nextColor,
      name: displayName,
      isHost: false,
      isConnected: true,
    };
    const updatedPlayers = [...room.players, player];
    const { data: updateData, error: updateError } = await this.supabase.client
      .from('rooms')
      .update({ players: updatedPlayers })
      .eq('id', roomId)
      .select('*')
      .single();
    if (updateError) throw updateError;
    const updated = rowToRoom(updateData);
    this.currentRoomW.set(updated);
    return updated;
  }

  async leaveRoom(roomId: string): Promise<void> {
    const userId = this.auth.userId;
    if (!userId) return;
    const { data, error } = await this.supabase.client
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (error) throw error;
    const room = rowToRoom(data);
    const updatedPlayers = room.players.filter((p) => p.id !== userId);
    if (updatedPlayers.length === 0) {
      await this.supabase.client.from('rooms').delete().eq('id', roomId);
    } else {
      const newHost = updatedPlayers[0];
      updatedPlayers[0] = { ...newHost, isHost: true };
      await this.supabase.client
        .from('rooms')
        .update({ players: updatedPlayers, host_id: newHost.id })
        .eq('id', roomId);
    }
    this.currentRoomW.set(null);
  }

  async kickPlayer(roomId: string, targetPlayerId: string): Promise<void> {
    const userId = this.auth.userId;
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await this.supabase.client
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (error) throw error;
    const room = rowToRoom(data);
    const host = room.players.find(p => p.id === userId);
    if (!host?.isHost) throw new Error('Only host can kick players');
    const updatedPlayers = room.players.filter(p => p.id !== targetPlayerId);
    const { error: updateError } = await this.supabase.client
      .from('rooms')
      .update({ players: updatedPlayers })
      .eq('id', roomId);
    if (updateError) throw updateError;
  }

  subscribeToRoom(roomId: string, onUpdate: (room: Room) => void): () => void {
    this.roomChannel = this.supabase.client
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload: RealtimePostgresChangesPayload<RoomRow>) => {
          if (payload.new && typeof payload.new === 'object') {
            const room = rowToRoom(payload.new as RoomRow);
            this.currentRoomW.set(room);
            onUpdate(room);
          }
        },
      )
      .subscribe();
    return () => {
      this.roomChannel?.unsubscribe();
      this.roomChannel = null;
    };
  }

  subscribeToRoomsList(onUpdate: (rooms: Room[]) => void): () => void {
    const channel = this.supabase.client
      .channel('rooms-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        async () => {
          const rooms = await this.listRooms();
          onUpdate(rooms);
        },
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }
}
