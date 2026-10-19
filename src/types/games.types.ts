import type { Profile } from './database.types';

export type GameType = 'pool' | 'tic_tac_toe';

export type GameRoomStatus = 'waiting' | 'active' | 'completed' | 'cancelled';

export interface GameRoom {
  id: string;
  room_code: string;
  game_type: GameType;
  status: GameRoomStatus;
  host_user_id: string;
  guest_user_id: string | null;
  current_turn_user_id: string | null;
  game_state: any;
  state_version: number;
  winner_user_id: string | null;
  rematch_requested_by: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  // Joined fields
  host?: Profile | null;
  guest?: Profile | null;
}

// ==========================================
// TIC-TAC-TOE TYPES
// ==========================================

export type TicTacToeSymbol = 'X' | 'O';

export interface TicTacToeState {
  board: (string | null)[];
  lastMove?: number | null;
  winningLine?: number[] | null;
  isDraw?: boolean;
}

// ==========================================
// 8-BALL POOL TYPES
// ==========================================

export type PoolBallType = 'cue' | 'solid' | 'stripe' | '8ball';

export interface PoolBallState {
  id: number;
  number: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isPocketed: boolean;
  type: PoolBallType;
  color: string;
}

export type BallGroup = 'solids' | 'stripes';

export interface PoolGameState {
  balls: PoolBallState[];
  cueBallInHand: boolean;
  assignedGroups: Record<string, BallGroup>; // user_id -> 'solids' | 'stripes'
  breakShotTaken: boolean;
  lastShotFoul: string | null;
  winnerReason: string | null;
}

export interface PoolShotCommand {
  cueAngle: number; // in radians
  shotPower: number; // 0.0 to 1.0 normalized
  stateVersion: number;
}
