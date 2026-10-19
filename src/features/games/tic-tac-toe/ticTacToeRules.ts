import type { TicTacToeState } from '@/types/games.types';

export const WINNING_LINES = [
  [0, 1, 2], // Row 1
  [3, 4, 5], // Row 2
  [6, 7, 8], // Row 3
  [0, 3, 6], // Col 1
  [1, 4, 7], // Col 2
  [2, 5, 8], // Col 3
  [0, 4, 8], // Diagonal 1
  [2, 4, 6], // Diagonal 2
];

export const createInitialTicTacToeState = (): TicTacToeState => ({
  board: Array(9).fill(null),
  lastMove: null,
  winningLine: null,
  isDraw: false,
});

export const checkWinner = (
  board: (string | null)[]
): {
  winner: string | null;
  winningLine: number[] | null;
  isDraw: boolean;
} => {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return {
        winner: board[a],
        winningLine: [a, b, c],
        isDraw: false,
      };
    }
  }

  const isFull = board.every((cell) => cell !== null && cell !== '');
  return {
    winner: null,
    winningLine: null,
    isDraw: isFull,
  };
};

export const isValidMove = (board: (string | null)[], cellIndex: number): boolean => {
  if (cellIndex < 0 || cellIndex > 8) return false;
  return board[cellIndex] === null || board[cellIndex] === '';
};
