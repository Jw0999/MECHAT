import { describe, it, expect } from 'bun:test';
import { generateRoomCode, gameRoomService } from '../src/features/games/services/gameRoomService';
import { createInitialTicTacToeState } from '../src/features/games/tic-tac-toe/ticTacToeRules';
import { createInitialPoolGameState } from '../src/features/games/pool/poolPhysics';
import { useAuthStore } from '../src/stores/authStore';

describe('Game Rooms & Multiplayer Service', () => {
  it('generates cryptographically secure, 6-character room codes without confusing letters', () => {
    const codes = new Set<string>();
    const forbiddenChars = ['0', 'O', '1', 'I'];

    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code.length).toBe(6);
      expect(code).toBe(code.toUpperCase());

      // No ambiguous characters
      for (const char of forbiddenChars) {
        expect(code.includes(char)).toBe(false);
      }
      codes.add(code);
    }

    // High entropy
    expect(codes.size).toBe(50);
  });

  it('creates and joins a Tic-Tac-Toe multiplayer room in demo mode', async () => {
    useAuthStore.getState().enableDemoMode(0);

    const initialState = createInitialTicTacToeState();
    const room = await gameRoomService.createRoom('tic_tac_toe', initialState);

    expect(room).toBeDefined();
    expect(room.id).toBeDefined();
    expect(room.room_code.length).toBe(6);
    expect(room.game_type).toBe('tic_tac_toe');
    expect(room.status).toBe('waiting');
    expect(room.host_user_id).toBeDefined();
    expect(room.guest_user_id).toBeNull();

    // Guest joins room
    const joinedRoom = await gameRoomService.joinRoom(room.room_code);
    expect(joinedRoom.status).toBe('active');
    expect(joinedRoom.guest_user_id).toBeDefined();
    expect(joinedRoom.guest).toBeDefined();
  });

  it('creates and joins an 8-Ball Pool multiplayer room in demo mode', async () => {
    useAuthStore.getState().enableDemoMode(0);

    const initialPoolState = createInitialPoolGameState();
    const room = await gameRoomService.createRoom('pool', initialPoolState);

    expect(room).toBeDefined();
    expect(room.game_type).toBe('pool');
    expect(room.status).toBe('waiting');
    expect(room.game_state.balls.length).toBe(16);

    // Guest joins
    const joinedRoom = await gameRoomService.joinRoom(room.room_code);
    expect(joinedRoom.status).toBe('active');
    expect(joinedRoom.guest_user_id).toBeDefined();
  });
});
