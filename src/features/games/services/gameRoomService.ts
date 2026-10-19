import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import type { GameRoom, GameType, PoolShotCommand } from '@/types/games.types';
import type { Profile } from '@/types/database.types';

// Cryptographically secure random room code generation (excludes 0, O, 1, I for clarity)
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export const generateRoomCode = (): string => {
  const bytes = new Uint8Array(6);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 6; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
};

// In-memory demo room cache for offline / demo mode support
const demoRooms = new Map<string, GameRoom>();

export const gameRoomService = {
  createRoom: async (gameType: GameType, initialState: any): Promise<GameRoom> => {
    const { user, profile, isDemoMode } = useAuthStore.getState();
    const currentUserId = user?.id || 'demo-user-1';
    const roomCode = generateRoomCode();

    if (!isDemoMode && isSupabaseConfigured() && user) {
      try {
        // Attempt trusted RPC creation first
        const { data, error } = await supabase.rpc('create_game_room', {
          p_game_type: gameType,
          p_room_code: roomCode,
          p_initial_state: initialState,
        });

        if (error) {
          console.warn('RPC create_game_room error, falling back to direct insert:', error);
          // Fallback direct table insert if migration RPC not yet applied in remote project
          const { data: insertData, error: insertError } = await supabase
            .from('game_rooms')
            .insert({
              room_code: roomCode,
              game_type: gameType,
              status: 'waiting',
              host_user_id: user.id,
              current_turn_user_id: user.id,
              game_state: initialState,
              state_version: 1,
            })
            .select('*')
            .single();

          if (insertError) throw insertError;
          return { ...insertData, host: profile };
        }

        return { ...data, host: profile };
      } catch (err: any) {
        console.error('Failed to create online room:', err);
        throw new Error(err.message || 'Failed to create game room');
      }
    }

    // Demo Mode in-memory fallback
    const demoRoom: GameRoom = {
      id: `room-${Date.now()}`,
      room_code: roomCode,
      game_type: gameType,
      status: 'waiting',
      host_user_id: currentUserId,
      guest_user_id: null,
      current_turn_user_id: currentUserId,
      game_state: initialState,
      state_version: 1,
      winner_user_id: null,
      rematch_requested_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      host: profile || {
        id: currentUserId,
        display_name: 'You',
        username: 'you',
        avatar_url: '',
        bio: '',
        online_status: 'online',
        last_seen: '',
        privacy_online: true,
        privacy_last_seen: true,
        privacy_read_receipts: true,
        created_at: '',
        updated_at: '',
      },
      guest: null,
    };
    demoRooms.set(demoRoom.id, demoRoom);
    demoRooms.set(demoRoom.room_code, demoRoom);
    return demoRoom;
  },

  joinRoom: async (rawRoomCode: string): Promise<GameRoom> => {
    const { user, profile, isDemoMode } = useAuthStore.getState();
    const currentUserId = user?.id || 'demo-user-2';
    const cleanCode = rawRoomCode.trim().toUpperCase();

    if (!cleanCode) {
      throw new Error('Please enter a valid room code');
    }

    if (!isDemoMode && isSupabaseConfigured() && user) {
      try {
        // Attempt trusted RPC join
        const { data, error } = await supabase.rpc('join_game_room', {
          p_room_code: cleanCode,
        });

        if (error) {
          console.warn('RPC join_game_room error, falling back to direct query:', error);
          // Fallback direct table query and atomic update
          const { data: existing, error: findError } = await supabase
            .from('game_rooms')
            .select('*, host:profiles!host_user_id(*)')
            .eq('room_code', cleanCode)
            .single();

          if (findError || !existing) throw new Error('Room not found with that code');
          if (existing.status !== 'waiting') throw new Error('This room is no longer waiting for players');
          if (existing.host_user_id === user.id) return existing; // Host re-entering
          if (existing.guest_user_id && existing.guest_user_id !== user.id) {
            throw new Error('This room is already full');
          }

          const { data: updated, error: updateError } = await supabase
            .from('game_rooms')
            .update({
              guest_user_id: user.id,
              status: 'active',
              updated_at: new Date().toISOString(),
              state_version: existing.state_version + 1,
            })
            .eq('id', existing.id)
            .select('*, host:profiles!host_user_id(*), guest:profiles!guest_user_id(*)')
            .single();

          if (updateError) throw updateError;
          return updated;
        }

        // Fetch host and guest profiles
        const [hostProfile, guestProfile] = await Promise.all([
          data.host_user_id ? fetchProfile(data.host_user_id) : null,
          data.guest_user_id ? fetchProfile(data.guest_user_id) : null,
        ]);

        return { ...data, host: hostProfile, guest: guestProfile };
      } catch (err: any) {
        console.error('Failed to join online room:', err);
        throw new Error(err.message || 'Failed to join game room');
      }
    }

    // Demo Mode joining fallback
    const existing = demoRooms.get(cleanCode);
    if (!existing) {
      throw new Error('Room not found with that code (Demo Mode)');
    }
    if (existing.status !== 'waiting' && existing.host_user_id !== currentUserId) {
      throw new Error('Room is not waiting for players');
    }

    const updatedDemo: GameRoom = {
      ...existing,
      guest_user_id: currentUserId,
      status: 'active',
      state_version: existing.state_version + 1,
      guest: profile || {
        id: currentUserId,
        display_name: 'Opponent',
        username: 'opponent',
        avatar_url: '',
        bio: '',
        online_status: 'online',
        last_seen: '',
        privacy_online: true,
        privacy_last_seen: true,
        privacy_read_receipts: true,
        created_at: '',
        updated_at: '',
      },
    };
    demoRooms.set(updatedDemo.id, updatedDemo);
    demoRooms.set(updatedDemo.room_code, updatedDemo);
    return updatedDemo;
  },

  fetchRoom: async (roomId: string): Promise<GameRoom | null> => {
    const { isDemoMode } = useAuthStore.getState();

    if (!isDemoMode && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('game_rooms')
          .select('*, host:profiles!host_user_id(*), guest:profiles!guest_user_id(*)')
          .eq('id', roomId)
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('Failed to fetch room from Supabase:', err);
        return null;
      }
    }

    return demoRooms.get(roomId) || null;
  },

  submitTicTacToeMove: async (
    roomId: string,
    cellIndex: number,
    expectedVersion: number,
    channel?: any
  ): Promise<GameRoom> => {
    const { user, isDemoMode } = useAuthStore.getState();

    if (!isDemoMode && isSupabaseConfigured() && user) {
      const { data, error } = await supabase.rpc('submit_tic_tac_toe_move', {
        p_room_id: roomId,
        p_cell_index: cellIndex,
        p_expected_version: expectedVersion,
      });

      if (error) {
        console.warn('RPC submit_tic_tac_toe_move error:', error);
        throw new Error(error.message || 'Failed to submit move');
      }

      // Concurrently broadcast 0ms visual move event to opponent
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'game:move',
          payload: { cellIndex, stateVersion: expectedVersion + 1 },
        });
      }

      const [host, guest] = await Promise.all([
        fetchProfile(data.host_user_id),
        data.guest_user_id ? fetchProfile(data.guest_user_id) : null,
      ]);

      return { ...data, host, guest };
    }

    // Demo Mode local move simulation
    const room = demoRooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const board = [...(room.game_state?.board || Array(9).fill(''))];
    const symbol = room.current_turn_user_id === room.host_user_id ? 'X' : 'O';
    board[cellIndex] = symbol;

    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    let winner: string | null = null;
    let winningLine: number[] | null = null;
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[b] === board[c]) {
        winner = room.current_turn_user_id;
        winningLine = [a, b, c];
        break;
      }
    }
    const isDraw = !winner && board.every((c) => c !== '' && c !== null);
    const nextTurn = room.current_turn_user_id === room.host_user_id ? room.guest_user_id : room.host_user_id;

    const updated: GameRoom = {
      ...room,
      game_state: {
        board,
        lastMove: cellIndex,
        winningLine,
        isDraw,
      },
      current_turn_user_id: winner || isDraw ? null : nextTurn,
      winner_user_id: winner,
      status: winner || isDraw ? 'completed' : 'active',
      state_version: room.state_version + 1,
    };
    demoRooms.set(roomId, updated);
    return updated;
  },

  submitPoolShot: async (
    roomId: string,
    shotCommand: PoolShotCommand,
    settledState: any,
    nextTurnUserId: string | null,
    winnerUserId: string | null,
    expectedVersion: number,
    channel?: any
  ): Promise<GameRoom> => {
    const { user, isDemoMode } = useAuthStore.getState();

    // 1. Broadcast immediate shot command to opponent so physics sim starts in real-time
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'game:shot',
        payload: { shotCommand, expectedVersion },
      });
    }

    if (!isDemoMode && isSupabaseConfigured() && user) {
      const { data, error } = await supabase.rpc('submit_pool_shot', {
        p_room_id: roomId,
        p_shot_payload: shotCommand,
        p_settled_state: settledState,
        p_next_turn_user_id: nextTurnUserId,
        p_winner_user_id: winnerUserId,
        p_expected_version: expectedVersion,
      });

      if (error) {
        console.warn('RPC submit_pool_shot error:', error);
        throw new Error(error.message || 'Failed to submit shot');
      }

      const [host, guest] = await Promise.all([
        fetchProfile(data.host_user_id),
        data.guest_user_id ? fetchProfile(data.guest_user_id) : null,
      ]);

      return { ...data, host, guest };
    }

    // Demo Mode local shot reconciliation
    const room = demoRooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const updated: GameRoom = {
      ...room,
      game_state: settledState,
      current_turn_user_id: winnerUserId ? null : nextTurnUserId,
      winner_user_id: winnerUserId,
      status: winnerUserId ? 'completed' : 'active',
      state_version: room.state_version + 1,
    };
    demoRooms.set(roomId, updated);
    return updated;
  },

  requestRematch: async (roomId: string, resetState: any, channel?: any): Promise<GameRoom> => {
    const { user, isDemoMode } = useAuthStore.getState();

    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'game:rematch',
        payload: { roomId, userId: user?.id },
      });
    }

    if (!isDemoMode && isSupabaseConfigured() && user) {
      const { data, error } = await supabase.rpc('request_rematch', {
        p_room_id: roomId,
        p_reset_state: resetState,
      });

      if (error) throw new Error(error.message || 'Failed to request rematch');

      const [host, guest] = await Promise.all([
        fetchProfile(data.host_user_id),
        data.guest_user_id ? fetchProfile(data.guest_user_id) : null,
      ]);

      return { ...data, host, guest };
    }

    // Demo mode rematch resets immediately
    const room = demoRooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const updated: GameRoom = {
      ...room,
      status: 'active',
      game_state: resetState,
      current_turn_user_id: room.host_user_id,
      winner_user_id: null,
      rematch_requested_by: null,
      state_version: room.state_version + 1,
    };
    demoRooms.set(roomId, updated);
    return updated;
  },

  leaveRoom: async (roomId: string, channel?: any): Promise<void> => {
    const { user, isDemoMode } = useAuthStore.getState();

    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'game:leave',
        payload: { roomId, userId: user?.id },
      });
    }

    if (!isDemoMode && isSupabaseConfigured() && user) {
      try {
        await supabase.rpc('leave_game_room', { p_room_id: roomId });
      } catch (err) {
        console.warn('Leave room RPC failed:', err);
      }
    }

    const room = demoRooms.get(roomId);
    if (room) {
      room.status = 'cancelled';
    }
  },

  subscribeToRoom: (
    roomId: string,
    onRoomUpdated: (room: GameRoom) => void,
    onBroadcastEvent?: (event: string, payload: any) => void
  ) => {
    const { isDemoMode } = useAuthStore.getState();
    if (isDemoMode || !isSupabaseConfigured()) {
      return () => {};
    }

    const channel = supabase.channel(`game-room:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${roomId}`,
        },
        async (payload) => {
          if (payload.new && (payload.new as any).id) {
            const rawRoom = payload.new as any;
            const [host, guest] = await Promise.all([
              rawRoom.host_user_id ? fetchProfile(rawRoom.host_user_id) : null,
              rawRoom.guest_user_id ? fetchProfile(rawRoom.guest_user_id) : null,
            ]);
            onRoomUpdated({ ...rawRoom, host, guest });
          }
        }
      )
      .on('broadcast', { event: '*' }, (payload) => {
        if (onBroadcastEvent) {
          onBroadcastEvent(payload.event, payload.payload);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Re-fetch room upon successful connection to guarantee zero state drift
          gameRoomService.fetchRoom(roomId).then((room) => {
            if (room) onRoomUpdated(room);
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

const profileCache = new Map<string, Profile>();
async function fetchProfile(userId: string): Promise<Profile | null> {
  if (profileCache.has(userId)) return profileCache.get(userId)!;
  try {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      profileCache.set(userId, data);
      return data;
    }
  } catch {
    // fallback
  }
  return null;
}
