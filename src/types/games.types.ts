import type { Profile } from './database.types';

export type GameType = 'pool' | 'tic_tac_toe' | 'whot' | 'trivia';

export type GameCategory = '2player' | 'group';

export type GameRoomStatus = 'waiting' | 'active' | 'completed' | 'cancelled';

export interface GameRoom {
  id: string;
  room_code: string;
  game_type: GameType;
  status: GameRoomStatus;
  host_user_id: string;
  guest_user_id: string | null;
  conversation_id?: string | null; // Group conversation ID
  players?: { user_id: string; profile: Profile }[];
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

// ==========================================
// NAIJA WHOT TYPES (GROUP CARD GAME)
// ==========================================

export type WhotShape = 'circle' | 'triangle' | 'cross' | 'square' | 'star' | 'whot';

export interface WhotCard {
  id: string;
  shape: WhotShape;
  number: number;
  label?: string; // e.g. "Hold On", "Pick Two", "Whot 20"
}

export interface WhotPlayer {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  hand: WhotCard[];
  isLastCard?: boolean;
}

export interface WhotGameState {
  drawPile: WhotCard[];
  discardPile: WhotCard[];
  players: WhotPlayer[];
  currentTurnUserId: string;
  requestedShape: WhotShape | null; // Set when 20 (Whot) is played
  pendingPickCount: number; // For stacked Pick Two / Pick Three
  activeActionNotice: string | null;
  winnerUserId: string | null;
  winnerReason: string | null;
  conversationId?: string | null;
}

// ==========================================
// TRIVIA CLASH TYPES (GROUP QUIZ GAME)
// ==========================================

export interface TriviaQuestion {
  id: string;
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TriviaPlayer {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  score: number;
  selectedOptionIndex?: number | null;
  answeredAtMs?: number | null;
  isCorrect?: boolean | null;
}

export interface TriviaGameState {
  questions: TriviaQuestion[];
  currentQuestionIndex: number;
  timeLimitSeconds: number;
  questionStartedAt: number;
  players: TriviaPlayer[];
  completed: boolean;
  winnerUserId: string | null;
  conversationId?: string | null;
}
