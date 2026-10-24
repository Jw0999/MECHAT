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

  it('generates distinct room code prefixes according to game type', () => {
    expect(generateRoomCode('pool').startsWith('P')).toBe(true);
    expect(generateRoomCode('whot').startsWith('W')).toBe(true);
    expect(generateRoomCode('trivia').startsWith('Q')).toBe(true);
    expect(generateRoomCode('tic_tac_toe').startsWith('T')).toBe(true);
  });

  it('guarantees joining players land in the exact game sent by host via hint or prefix', async () => {
    useAuthStore.getState().enableDemoMode(0);

    // 1. Host creates 8-Ball Pool room
    const poolRoom = await gameRoomService.createRoom('pool');
    expect(poolRoom.game_type).toBe('pool');
    expect(poolRoom.room_code.startsWith('P')).toBe(true);

    // Guest joins Pool room by code
    const joinedPool = await gameRoomService.joinRoom(poolRoom.room_code);
    expect(joinedPool.game_type).toBe('pool');
    expect(joinedPool.game_state.balls).toBeDefined();

    // 2. Host creates Naija Whot group room
    const whotRoom = await gameRoomService.createRoom('whot');
    expect(whotRoom.game_type).toBe('whot');
    expect(whotRoom.room_code.startsWith('W')).toBe(true);

    // Switch user so guest has distinct ID
    useAuthStore.getState().enableDemoMode(1);
    const joinedWhot = await gameRoomService.joinRoom(whotRoom.room_code, 'whot');
    expect(joinedWhot.game_type).toBe('whot');
    expect(joinedWhot.game_state.players.length).toBeGreaterThanOrEqual(2);

    // 3. Host creates Trivia Clash group room
    useAuthStore.getState().enableDemoMode(0);
    const triviaRoom = await gameRoomService.createRoom('trivia');
    expect(triviaRoom.game_type).toBe('trivia');
    expect(triviaRoom.room_code.startsWith('Q')).toBe(true);

    // Switch user so guest has distinct ID
    useAuthStore.getState().enableDemoMode(1);
    const joinedTrivia = await gameRoomService.joinRoom(triviaRoom.room_code, 'trivia');
    expect(joinedTrivia.game_type).toBe('trivia');
    expect(joinedTrivia.game_state.players.length).toBeGreaterThanOrEqual(2);
  });

  it('automatically adds joining squad players into active Whot and Trivia matches', async () => {
    useAuthStore.getState().enableDemoMode(0);

    // Create Whot room
    const whotRoom = await gameRoomService.createRoom('whot');
    const initialWhotPlayersCount = whotRoom.game_state.players.length;

    // Second user joins
    useAuthStore.getState().enableDemoMode(1);
    const joinedWhot = await gameRoomService.joinRoom(whotRoom.room_code);
    expect(joinedWhot.game_state.players.length).toBe(initialWhotPlayersCount + 1);
    const joinedWhotPlayer = joinedWhot.game_state.players.find(
      (p: any) => p.user_id === useAuthStore.getState().user?.id
    );
    expect(joinedWhotPlayer).toBeDefined();
    expect(joinedWhotPlayer.hand.length).toBe(5);

    // Create Trivia room
    const triviaRoom = await gameRoomService.createRoom('trivia');
    const initialTriviaPlayersCount = triviaRoom.game_state.players.length;

    // Third user joins
    useAuthStore.getState().enableDemoMode(2);
    const joinedTrivia = await gameRoomService.joinRoom(triviaRoom.room_code);
    expect(joinedTrivia.game_state.players.length).toBe(initialTriviaPlayersCount + 1);
    const joinedTriviaPlayer = joinedTrivia.game_state.players.find(
      (p: any) => p.user_id === useAuthStore.getState().user?.id
    );
    expect(joinedTriviaPlayer).toBeDefined();
    expect(joinedTriviaPlayer.score).toBe(0);
  });
});
