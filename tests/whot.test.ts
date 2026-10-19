import { describe, it, expect } from 'bun:test';
import {
  createWhotDeck,
  createInitialWhotGameState,
  isValidWhotMove,
  applyWhotMove,
  applyWhotDraw,
} from '../src/features/games/whot/whotRules';
import type { WhotCard } from '../src/types/games.types';

describe('Naija Whot! (Whot Whot) Rules & Mechanics', () => {
  it('generates a full standard 54-card deck with correct card counts', () => {
    const deck = createWhotDeck();
    expect(deck.length).toBe(54);

    const circles = deck.filter((c) => c.shape === 'circle');
    expect(circles.length).toBe(12);

    const triangles = deck.filter((c) => c.shape === 'triangle');
    expect(triangles.length).toBe(12);

    const crosses = deck.filter((c) => c.shape === 'cross');
    expect(crosses.length).toBe(9);

    const squares = deck.filter((c) => c.shape === 'square');
    expect(squares.length).toBe(9);

    const stars = deck.filter((c) => c.shape === 'star');
    expect(stars.length).toBe(7);

    const whotWilds = deck.filter((c) => c.number === 20 || c.shape === 'whot');
    expect(whotWilds.length).toBe(5);
  });

  it('deals 5 cards to each group member and sets initial call card', () => {
    const members = [
      { id: 'user-1', display_name: 'Player 1' },
      { id: 'user-2', display_name: 'Player 2' },
      { id: 'user-3', display_name: 'Player 3' },
    ];
    const state = createInitialWhotGameState(members, 'conv-group-1');

    expect(state.players.length).toBe(3);
    state.players.forEach((p) => {
      expect(p.hand.length).toBe(5);
    });

    expect(state.discardPile.length).toBe(1);
    expect(state.discardPile[0]).toBeDefined();
    expect(state.currentTurnUserId).toBe('user-1');
  });

  it('validates legal moves: matching shape, matching number, or Whot 20 wild card', () => {
    const topCard: WhotCard = { id: 'c-1', shape: 'circle', number: 7 };

    // Same shape (Circle 3): Legal
    expect(isValidWhotMove({ id: 'c-2', shape: 'circle', number: 3 }, topCard, null, 0)).toBe(true);

    // Same number (Triangle 7): Legal
    expect(isValidWhotMove({ id: 'c-3', shape: 'triangle', number: 7 }, topCard, null, 0)).toBe(true);

    // Whot 20: Always legal
    expect(isValidWhotMove({ id: 'c-4', shape: 'whot', number: 20 }, topCard, null, 0)).toBe(true);

    // Different shape & number (Star 4): Illegal
    expect(isValidWhotMove({ id: 'c-5', shape: 'star', number: 4 }, topCard, null, 0)).toBe(false);

    // Requested shape (Star requested): Star is legal, Circle is illegal
    expect(isValidWhotMove({ id: 'c-6', shape: 'star', number: 4 }, topCard, 'star', 0)).toBe(true);
    expect(isValidWhotMove({ id: 'c-7', shape: 'circle', number: 3 }, topCard, 'star', 0)).toBe(false);
  });

  it('processes Action Card 1 (Hold On) allowing player to play again', () => {
    const members = [
      { id: 'user-1', display_name: 'Player 1' },
      { id: 'user-2', display_name: 'Player 2' },
    ];
    const state = createInitialWhotGameState(members);
    state.currentTurnUserId = 'user-1';

    const holdOnCard: WhotCard = { id: 'test-holdon', shape: 'circle', number: 1, label: 'Hold On' };
    state.players[0].hand = [holdOnCard, { id: 'card-b', shape: 'circle', number: 4 }];
    state.discardPile = [{ id: 'top', shape: 'circle', number: 7 }];

    const nextState = applyWhotMove(state, 'user-1', 'test-holdon');

    // Turn should still be user-1 because of Hold On
    expect(nextState.currentTurnUserId).toBe('user-1');
    expect(nextState.activeActionNotice).toContain('Hold On');
  });

  it('processes Action Card 2 (Pick Two) and enforces penalty or defense', () => {
    const members = [
      { id: 'user-1', display_name: 'Player 1' },
      { id: 'user-2', display_name: 'Player 2' },
    ];
    const state = createInitialWhotGameState(members);
    state.currentTurnUserId = 'user-1';

    const pickTwoCard: WhotCard = { id: 'test-pick2', shape: 'triangle', number: 2, label: 'Pick Two' };
    state.players[0].hand = [pickTwoCard, { id: 'card-b', shape: 'triangle', number: 4 }];
    state.discardPile = [{ id: 'top', shape: 'triangle', number: 7 }];

    const nextState = applyWhotMove(state, 'user-1', 'test-pick2');

    expect(nextState.pendingPickCount).toBe(2);
    expect(nextState.currentTurnUserId).toBe('user-2');

    // Player 2 draws penalty from market
    const afterDraw = applyWhotDraw(nextState, 'user-2');
    expect(afterDraw.players[1].hand.length).toBe(7); // 5 initial + 2 drawn
    expect(afterDraw.pendingPickCount).toBe(0);
    expect(afterDraw.currentTurnUserId).toBe('user-1');
  });

  it('triggers CHECK! and awards victory when a player clears their last card', () => {
    const members = [
      { id: 'user-1', display_name: 'Player 1' },
      { id: 'user-2', display_name: 'Player 2' },
    ];
    const state = createInitialWhotGameState(members);
    state.currentTurnUserId = 'user-1';

    const lastCard: WhotCard = { id: 'final-card', shape: 'square', number: 3 };
    state.players[0].hand = [lastCard]; // Single card
    state.discardPile = [{ id: 'top', shape: 'square', number: 7 }];

    const wonState = applyWhotMove(state, 'user-1', 'final-card');

    expect(wonState.winnerUserId).toBe('user-1');
    expect(wonState.winnerReason).toContain('CHECK');
    expect(wonState.players[0].hand.length).toBe(0);
  });
});
