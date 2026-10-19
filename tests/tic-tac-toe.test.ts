import { describe, it, expect } from 'bun:test';
import {
  checkWinner,
  createInitialTicTacToeState,
  isValidMove,
  WINNING_LINES,
} from '../src/features/games/tic-tac-toe/ticTacToeRules';

describe('Tic-Tac-Toe Rules Engine', () => {
  it('identifies an initial empty board as ongoing without winner or draw', () => {
    const state = createInitialTicTacToeState();
    const result = checkWinner(state.board);
    expect(result.winner).toBeNull();
    expect(result.winningLine).toBeNull();
    expect(result.isDraw).toBe(false);
  });

  it('validates all 8 winning combinations accurately', () => {
    // 3 Horizontal lines
    expect(checkWinner(['X', 'X', 'X', null, null, null, null, null, null]).winner).toBe('X');
    expect(checkWinner([null, null, null, 'O', 'O', 'O', null, null, null]).winner).toBe('O');
    expect(checkWinner([null, null, null, null, null, null, 'X', 'X', 'X']).winner).toBe('X');

    // 3 Vertical lines
    expect(checkWinner(['X', null, null, 'X', null, null, 'X', null, null]).winner).toBe('X');
    expect(checkWinner([null, 'O', null, null, 'O', null, null, 'O', null]).winner).toBe('O');
    expect(checkWinner([null, null, 'X', null, null, 'X', null, null, 'X']).winner).toBe('X');

    // 2 Diagonal lines
    expect(checkWinner(['O', null, null, null, 'O', null, null, null, 'O']).winner).toBe('O');
    expect(checkWinner([null, null, 'X', null, 'X', null, 'X', null, null]).winner).toBe('X');
  });

  it('correctly provides the exact winning line coordinates', () => {
    const board = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
    const result = checkWinner(board);
    expect(result.winner).toBe('X');
    expect(result.winningLine).toEqual([0, 1, 2]);
  });

  it('detects a draw when the board is completely full without any winner', () => {
    const drawBoard = [
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', 'X',
    ];
    const result = checkWinner(drawBoard);
    expect(result.winner).toBeNull();
    expect(result.winningLine).toBeNull();
    expect(result.isDraw).toBe(true);
  });

  it('does not trigger a draw if someone wins on the 9th move', () => {
    const winOnLastMove = [
      'X', 'X', 'X',
      'O', 'O', 'X',
      'O', 'X', 'O',
    ];
    const result = checkWinner(winOnLastMove);
    expect(result.winner).toBe('X');
    expect(result.isDraw).toBe(false);
  });

  it('correctly validates cell vacancy and bounds', () => {
    const board = ['X', null, null, null, null, null, null, null, null];
    expect(isValidMove(board, 0)).toBe(false); // occupied
    expect(isValidMove(board, 1)).toBe(true);  // empty
    expect(isValidMove(board, 8)).toBe(true);  // empty
    expect(isValidMove(board, -1)).toBe(false); // out of bounds
    expect(isValidMove(board, 9)).toBe(false);  // out of bounds
  });

  it('verifies that WINNING_LINES contains all 8 lines', () => {
    expect(WINNING_LINES.length).toBe(8);
  });
});
