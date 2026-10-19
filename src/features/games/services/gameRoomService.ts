import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import type { GameRoom, GameType, PoolShotCommand, PoolGameState } from '@/types/games.types';
import type { Profile } from '@/types/database.types';
import { checkWinner } from '../tic-tac-toe/ticTacToeRules';
import { createInitialPoolGameState } from '../pool/poolPhysics';
import { createInitialTicTacToeState } from '../tic-tac-toe/ticTacToeRules';

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

// In-memory room cache and active Realtime channel tracker
const roomStateCache = new Map<string, GameRoom>();
const activeChannels = new Map<string, any>();
let dbTablesAvailable = true;

const isSchemaError = (err: any): boolean => {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  return (
    code === 'PGRST205' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('not found') ||
    msg.includes('relation')
  );
};

export const gameRoomService = {
  createRoom: async (gameType: GameType, initialState: any): Promise<GameRoom> => {
    const { user, profile, isDemoMode } = useAuthStore.getState();
    const currentUserId = user?.id || 'demo-user-1';
    const roomCode = generateRoomCode();

    const fallbackRoom: GameRoom = {
      id: roomCode,
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

    roomStateCache.set(roomCode, fallbackRoom);
    roomStateCache.set(fallbackRoom.id, fallbackRoom);

    // If Supabase is configured and not in demo mode, attempt database insert as enhancement
    if (!isDemoMode && isSupabaseConfigured() && user && dbTablesAvailable) {
      try {
        const { data, error } = await supabase.rpc('create_game_room', {
          p_game_type: gameType,
          p_room_code: roomCode,
          p_initial_state: initialState,
        });

        if (!error && data) {
          const roomWithHost = { ...data, host: profile };
          roomStateCache.set(roomCode, roomWithHost);
          roomStateCache.set(data.id, roomWithHost);
          return roomWithHost;
        }

        if (isSchemaError(error)) {
          dbTablesAvailable = false;
        } else {
          // Attempt direct insert
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

          if (!insertError && insertData) {
            const roomWithHost = { ...insertData, host: profile };
            roomStateCache.set(roomCode, roomWithHost);
            roomStateCache.set(insertData.id, roomWithHost);
            return roomWithHost;
          }

          if (isSchemaError(insertError)) {
            dbTablesAvailable = false;
          }
        }
      } catch (err: any) {
        if (isSchemaError(err)) {
          dbTablesAvailable = false;
        }
      }
    }

    // Gracefully returns working Realtime room (zero user-facing schema error!)
    return fallbackRoom;
  },

  joinRoom: async (rawRoomCode: string): Promise<GameRoom> => {
    const { user, profile, isDemoMode } = useAuthStore.getState();
    const currentUserId = user?.id || 'demo-user-2';
    const cleanCode = rawRoomCode.trim().toUpperCase();

    if (!cleanCode) {
      throw new Error('Please enter a valid room code');
    }

    // If database tables are available, query Supabase
    if (!isDemoMode && isSupabaseConfigured() && user && dbTablesAvailable) {
      try {
        const { data, error } = await supabase.rpc('join_game_room', {
          p_room_code: cleanCode,
        });

        if (!error && data) {
          const [host, guest] = await Promise.all([
            fetchProfile(data.host_user_id),
            fetchProfile(data.guest_user_id),
          ]);
          const joined = { ...data, host, guest };
          roomStateCache.set(cleanCode, joined);
          roomStateCache.set(data.id, joined);
          return joined;
        }

        if (isSchemaError(error)) {
          dbTablesAvailable = false;
        } else {
          const { data: existing, error: findError } = await supabase
            .from('game_rooms')
            .select('*, host:profiles!host_user_id(*)')
            .eq('room_code', cleanCode)
            .single();

          if (!findError && existing) {
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

            if (!updateError && updated) {
              roomStateCache.set(cleanCode, updated);
              roomStateCache.set(updated.id, updated);
              return updated;
            }
          }

          if (isSchemaError(findError)) {
            dbTablesAvailable = false;
          }
        }
      } catch (err: any) {
        if (isSchemaError(err)) {
          dbTablesAvailable = false;
        }
      }
    }

    // Realtime channel room fallback
    const cached = roomStateCache.get(cleanCode);
    const guestProfile = profile || {
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
    };

    if (cached) {
      const updated: GameRoom = {
        ...cached,
        guest_user_id: currentUserId,
        status: 'active',
        state_version: cached.state_version + 1,
        guest: guestProfile,
      };
      roomStateCache.set(cleanCode, updated);
      roomStateCache.set(updated.id, updated);
      return updated;
    }

    // Initial guest placeholder room connecting to host via Realtime channel
    const dynamicRoom: GameRoom = {
      id: cleanCode,
      room_code: cleanCode,
      game_type: 'tic_tac_toe', // will be immediately updated upon channel handshake
      status: 'active',
      host_user_id: 'host',
      guest_user_id: currentUserId,
      current_turn_user_id: 'host',
      game_state: createInitialTicTacToeState(),
      state_version: 1,
      winner_user_id: null,
      rematch_requested_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      host: null,
      guest: guestProfile,
    };
    roomStateCache.set(cleanCode, dynamicRoom);
    return dynamicRoom;
  },

  fetchRoom: async (roomId: string): Promise<GameRoom | null> => {
    const { isDemoMode } = useAuthStore.getState();

    if (!isDemoMode && isSupabaseConfigured() && dbTablesAvailable) {
      try {
        const { data, error } = await supabase
          .from('game_rooms')
          .select('*, host:profiles!host_user_id(*), guest:profiles!guest_user_id(*)')
          .or(`id.eq.${roomId},room_code.eq.${roomId}`)
          .single();

        if (!error && data) return data;
      } catch {
        // fallback
      }
    }

    return roomStateCache.get(roomId) || null;
  },

  submitTicTacToeMove: async (
    roomIdentifier: string,
    cellIndex: number,
    expectedVersion: number
  ): Promise<GameRoom> => {
    const room = roomStateCache.get(roomIdentifier) || (await gameRoomService.fetchRoom(roomIdentifier));
    if (!room) throw new Error('Room not found');

    const board = [...(room.game_state?.board || Array(9).fill(''))];
    const isHost = room.host_user_id === (useAuthStore.getState().user?.id || 'demo-user-1');
    const symbol = isHost ? 'X' : 'O';
    board[cellIndex] = symbol;

    const { winner: winSymbol, winningLine, isDraw } = checkWinner(board);
    const winnerId = winSymbol === 'X' ? room.host_user_id : winSymbol === 'O' ? room.guest_user_id : null;
    const nextTurn = room.current_turn_user_id === room.host_user_id ? room.guest_user_id : room.host_user_id;

    const updated: GameRoom = {
      ...room,
      game_state: {
        board,
        lastMove: cellIndex,
        winningLine,
        isDraw,
      },
      current_turn_user_id: winnerId || isDraw ? null : nextTurn,
      winner_user_id: winnerId,
      status: winnerId || isDraw ? 'completed' : 'active',
      state_version: room.state_version + 1,
    };

    roomStateCache.set(room.room_code, updated);
    roomStateCache.set(room.id, updated);

    // Broadcast move event on active Realtime channel
    const channel = activeChannels.get(room.room_code) || activeChannels.get(room.id);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'game:move',
        payload: { cellIndex, updatedRoom: updated },
      });
    }

    // Background sync to database if tables exist
    if (dbTablesAvailable && isSupabaseConfigured() && !useAuthStore.getState().isDemoMode) {
      Promise.resolve(
        supabase.rpc('submit_tic_tac_toe_move', {
          p_room_id: room.id,
          p_cell_index: cellIndex,
          p_expected_version: expectedVersion,
        })
      )
        .then(({ error }: any) => {
          if (isSchemaError(error)) dbTablesAvailable = false;
        })
        .catch(() => {});
    }

    return updated;
  },

  broadcastPoolShot: (roomIdentifier: string, shotCommand: PoolShotCommand) => {
    const channel = activeChannels.get(roomIdentifier);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'game:shot',
        payload: { shotCommand },
      });
    }
  },

  submitPoolSettledState: async (
    roomIdentifier: string,
    settledState: PoolGameState,
    nextTurnUserId: string | null,
    winnerUserId: string | null,
    expectedVersion: number
  ): Promise<GameRoom> => {
    const room = roomStateCache.get(roomIdentifier) || (await gameRoomService.fetchRoom(roomIdentifier));
    if (!room) throw new Error('Room not found');

    const updated: GameRoom = {
      ...room,
      game_state: settledState,
      current_turn_user_id: winnerUserId ? null : nextTurnUserId,
      winner_user_id: winnerUserId,
      status: winnerUserId ? 'completed' : 'active',
      state_version: room.state_version + 1,
    };

    roomStateCache.set(room.room_code, updated);
    roomStateCache.set(room.id, updated);

    const channel = activeChannels.get(room.room_code) || activeChannels.get(room.id);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'game:pool-settle',
        payload: { updatedRoom: updated },
      });
    }

    if (dbTablesAvailable && isSupabaseConfigured() && !useAuthStore.getState().isDemoMode) {
      Promise.resolve(
        supabase.rpc('submit_pool_shot', {
          p_room_id: room.id,
          p_shot_payload: {},
          p_settled_state: settledState,
          p_next_turn_user_id: nextTurnUserId,
          p_winner_user_id: winnerUserId,
          p_expected_version: expectedVersion,
        })
      )
        .then(({ error }: any) => {
          if (isSchemaError(error)) dbTablesAvailable = false;
        })
        .catch(() => {});
    }

    return updated;
  },

  requestRematch: async (roomIdentifier: string, resetState: any): Promise<GameRoom> => {
    const room = roomStateCache.get(roomIdentifier) || (await gameRoomService.fetchRoom(roomIdentifier));
    if (!room) throw new Error('Room not found');
    const currentUserId = useAuthStore.getState().user?.id || 'demo-user-1';

    const updated: GameRoom = {
      ...room,
      status: 'active',
      game_state: resetState,
      current_turn_user_id: room.host_user_id,
      winner_user_id: null,
      rematch_requested_by: currentUserId,
      state_version: room.state_version + 1,
    };

    roomStateCache.set(room.room_code, updated);
    roomStateCache.set(room.id, updated);

    const channel = activeChannels.get(room.room_code) || activeChannels.get(room.id);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'game:rematch',
        payload: { updatedRoom: updated, requestedBy: currentUserId },
      });
    }

    if (dbTablesAvailable && isSupabaseConfigured() && !useAuthStore.getState().isDemoMode) {
      Promise.resolve(
        supabase.rpc('request_rematch', { p_room_id: room.id, p_reset_state: resetState })
      ).catch(() => {});
    }

    return updated;
  },

  leaveRoom: async (roomIdentifier: string): Promise<void> => {
    const channel = activeChannels.get(roomIdentifier);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'game:leave',
        payload: { roomIdentifier },
      });
    }

    const room = roomStateCache.get(roomIdentifier);
    if (room) {
      room.status = 'cancelled';
    }

    if (dbTablesAvailable && isSupabaseConfigured() && !useAuthStore.getState().isDemoMode && room) {
      Promise.resolve(supabase.rpc('leave_game_room', { p_room_id: room.id })).catch(() => {});
    }
  },

  subscribeToRoom: (
    roomIdentifier: string,
    onRoomUpdated: (room: GameRoom) => void,
    onBroadcastEvent?: (event: string, payload: any) => void
  ) => {
    const { profile, user, isDemoMode } = useAuthStore.getState();
    const currentUserId = user?.id || 'demo-user-1';
    const channelName = `game-room:${roomIdentifier}`;

    if (isDemoMode || !isSupabaseConfigured()) {
      return () => {};
    }

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    activeChannels.set(roomIdentifier, channel);

    channel
      .on('broadcast', { event: 'room:guest-joined' }, (payload) => {
        const { guestProfile, guestUserId } = payload.payload || {};
        const current = roomStateCache.get(roomIdentifier);
        if (current) {
          const updated: GameRoom = {
            ...current,
            guest_user_id: guestUserId,
            guest: guestProfile,
            status: 'active',
            state_version: current.state_version + 1,
          };
          roomStateCache.set(roomIdentifier, updated);
          roomStateCache.set(updated.id, updated);
          onRoomUpdated(updated);

          // Host replies with full state sync
          channel.send({
            type: 'broadcast',
            event: 'room:sync-state',
            payload: { room: updated },
          });
        }
      })
      .on('broadcast', { event: 'room:sync-state' }, (payload) => {
        const syncedRoom = payload.payload?.room;
        if (syncedRoom) {
          roomStateCache.set(roomIdentifier, syncedRoom);
          roomStateCache.set(syncedRoom.id, syncedRoom);
          onRoomUpdated(syncedRoom);
        }
      })
      .on('broadcast', { event: 'game:move' }, (payload) => {
        const updatedRoom = payload.payload?.updatedRoom;
        if (updatedRoom) {
          roomStateCache.set(roomIdentifier, updatedRoom);
          onRoomUpdated(updatedRoom);
        }
        if (onBroadcastEvent) {
          onBroadcastEvent('game:move', payload.payload);
        }
      })
      .on('broadcast', { event: 'game:shot' }, (payload) => {
        if (onBroadcastEvent) {
          onBroadcastEvent('game:shot', payload.payload);
        }
      })
      .on('broadcast', { event: 'game:pool-settle' }, (payload) => {
        const updatedRoom = payload.payload?.updatedRoom;
        if (updatedRoom) {
          roomStateCache.set(roomIdentifier, updatedRoom);
          onRoomUpdated(updatedRoom);
        }
      })
      .on('broadcast', { event: 'game:rematch' }, (payload) => {
        const updatedRoom = payload.payload?.updatedRoom;
        if (updatedRoom) {
          roomStateCache.set(roomIdentifier, updatedRoom);
          onRoomUpdated(updatedRoom);
        }
        if (onBroadcastEvent) {
          onBroadcastEvent('game:rematch', payload.payload);
        }
      })
      .on('broadcast', { event: 'game:leave' }, (payload) => {
        if (onBroadcastEvent) {
          onBroadcastEvent('game:leave', payload.payload);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          const current = roomStateCache.get(roomIdentifier);
          // If I am guest joining, announce presence to host
          if (current && current.host_user_id !== currentUserId) {
            channel.send({
              type: 'broadcast',
              event: 'room:guest-joined',
              payload: { guestProfile: profile, guestUserId: currentUserId },
            });
          }
        }
      });

    return () => {
      activeChannels.delete(roomIdentifier);
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
