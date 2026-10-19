import { describe, it, expect } from 'bun:test';
import {
  createInitialPoolBalls,
  createInitialPoolGameState,
  applyShotToBalls,
  stepPhysics,
  isTableStationary,
  evaluatePoolShot,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  PLAYFIELD,
} from '../src/features/games/pool/poolPhysics';

describe('8-Ball Pool Physics & Rules Engine', () => {
  it('generates an exact regulation rack of 16 balls with 8-ball in center', () => {
    const balls = createInitialPoolBalls();
    expect(balls.length).toBe(16);

    // Cue ball
    const cue = balls.find((b) => b.id === 0);
    expect(cue).toBeDefined();
    expect(cue?.type).toBe('cue');
    expect(cue?.x).toBe(200);
    expect(cue?.y).toBe(TABLE_HEIGHT / 2);

    // 8-ball
    const eight = balls.find((b) => b.id === 8);
    expect(eight).toBeDefined();
    expect(eight?.type).toBe('8ball');

    // 7 Solids (1-7)
    const solids = balls.filter((b) => b.type === 'solid');
    expect(solids.length).toBe(7);

    // 7 Stripes (9-15)
    const stripes = balls.filter((b) => b.type === 'stripe');
    expect(stripes.length).toBe(7);
  });

  it('applies directional impulse to cue ball according to shot angle and power', () => {
    const balls = createInitialPoolBalls();
    const cue = balls.find((b) => b.id === 0)!;

    // Shot pointing straight right (angle 0) at 50% power
    applyShotToBalls(balls, 0, 0.5);
    expect(cue.vx).toBeGreaterThan(0);
    expect(cue.vy).toBe(0);

    // Table is now active (not stationary)
    expect(isTableStationary(balls)).toBe(false);
  });

  it('reflects ball velocity when colliding with table cushion rails', () => {
    const balls = createInitialPoolBalls();
    const cue = balls.find((b) => b.id === 0)!;

    // Position ball near right cushion moving right
    cue.x = PLAYFIELD.right - 2;
    cue.vx = 400;
    cue.vy = 0;

    stepPhysics(balls, 0.05);

    // Velocity should be inverted and dampened
    expect(cue.vx).toBeLessThan(0);
    expect(cue.x).toBeLessThanOrEqual(PLAYFIELD.right);
  });

  it('detects ball pocketing and zeroes velocity when reaching a pocket', () => {
    const balls = createInitialPoolBalls();
    const cue = balls.find((b) => b.id === 0)!;

    // Place cue ball directly over top-left pocket
    cue.x = 28;
    cue.y = 28;
    cue.vx = 50;
    cue.vy = 50;

    stepPhysics(balls, 0.02);

    expect(cue.isPocketed).toBe(true);
    expect(cue.vx).toBe(0);
    expect(cue.vy).toBe(0);
  });

  it('evaluates scratch and awards ball-in-hand to opponent', () => {
    const beforeState = createInitialPoolGameState();
    const afterBalls = createInitialPoolBalls();
    const cue = afterBalls.find((b) => b.id === 0)!;
    cue.isPocketed = true; // Cue ball sunk!

    const evalResult = evaluatePoolShot(beforeState, afterBalls, 'user-a', 'user-b');

    expect(evalResult.foulMessage).toContain('Scratch');
    expect(evalResult.settledState.cueBallInHand).toBe(true);
    expect(evalResult.nextTurnUserId).toBe('user-b');
    expect(evalResult.winnerUserId).toBeNull();
  });

  it('assigns suits (solids vs stripes) to players on first legal pocketed object ball', () => {
    const beforeState = createInitialPoolGameState();
    const afterBalls = createInitialPoolBalls();

    // Player pockets Ball 3 (solid red)
    const ball3 = afterBalls.find((b) => b.id === 3)!;
    ball3.isPocketed = true;

    const evalResult = evaluatePoolShot(beforeState, afterBalls, 'user-a', 'user-b');

    expect(evalResult.settledState.assignedGroups['user-a']).toBe('solids');
    expect(evalResult.settledState.assignedGroups['user-b']).toBe('stripes');
    // Retains turn for pocketing legal group ball
    expect(evalResult.nextTurnUserId).toBe('user-a');
  });

  it('penalizes player with a loss if 8-ball is pocketed prematurely', () => {
    const beforeState = createInitialPoolGameState();
    beforeState.assignedGroups = { 'user-a': 'solids', 'user-b': 'stripes' };

    const afterBalls = createInitialPoolBalls();
    const eight = afterBalls.find((b) => b.id === 8)!;
    eight.isPocketed = true; // 8-ball sunk while solids remain on table!

    const evalResult = evaluatePoolShot(beforeState, afterBalls, 'user-a', 'user-b');

    expect(evalResult.winnerUserId).toBe('user-b');
    expect(evalResult.settledState.winnerReason).toContain('prematurely');
  });

  it('awards victory when player clears all suit balls and pockets 8-ball legally', () => {
    const beforeState = createInitialPoolGameState();
    beforeState.assignedGroups = { 'user-a': 'solids', 'user-b': 'stripes' };

    const afterBalls = createInitialPoolBalls();
    // Mark all solids pocketed
    afterBalls.forEach((b) => {
      if (b.type === 'solid') b.isPocketed = true;
    });

    // Legally pocket 8-ball
    const eight = afterBalls.find((b) => b.id === 8)!;
    eight.isPocketed = true;

    const evalResult = evaluatePoolShot(beforeState, afterBalls, 'user-a', 'user-b');

    expect(evalResult.winnerUserId).toBe('user-a');
    expect(evalResult.settledState.winnerReason).toContain('win the match');
  });
});
