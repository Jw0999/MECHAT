import type { PoolBallState, BallGroup, PoolGameState } from '@/types/games.types';

export const TABLE_WIDTH = 800;
export const TABLE_HEIGHT = 400;
export const BALL_RADIUS = 10;
export const POCKET_RADIUS_CORNER = 22;
export const POCKET_RADIUS_MIDDLE = 19;
export const CUSHION_INSET = 26;

export const PLAYFIELD = {
  left: CUSHION_INSET + BALL_RADIUS,
  right: TABLE_WIDTH - CUSHION_INSET - BALL_RADIUS,
  top: CUSHION_INSET + BALL_RADIUS,
  bottom: TABLE_HEIGHT - CUSHION_INSET - BALL_RADIUS,
};

export const POCKETS = [
  { x: CUSHION_INSET + 2, y: CUSHION_INSET + 2, radius: POCKET_RADIUS_CORNER }, // Top-Left
  { x: TABLE_WIDTH / 2, y: CUSHION_INSET - 2, radius: POCKET_RADIUS_MIDDLE }, // Top-Middle
  { x: TABLE_WIDTH - CUSHION_INSET - 2, y: CUSHION_INSET + 2, radius: POCKET_RADIUS_CORNER }, // Top-Right
  { x: CUSHION_INSET + 2, y: TABLE_HEIGHT - CUSHION_INSET - 2, radius: POCKET_RADIUS_CORNER }, // Bottom-Left
  { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - CUSHION_INSET + 2, radius: POCKET_RADIUS_MIDDLE }, // Bottom-Middle
  { x: TABLE_WIDTH - CUSHION_INSET - 2, y: TABLE_HEIGHT - CUSHION_INSET - 2, radius: POCKET_RADIUS_CORNER }, // Bottom-Right
];

const BALL_COLORS: Record<number, string> = {
  0: '#FFFFFF', // Cue Ball
  1: '#FBBF24', // 1 Solid Yellow
  2: '#2563EB', // 2 Solid Blue
  3: '#DC2626', // 3 Solid Red
  4: '#7C3AED', // 4 Solid Purple
  5: '#EA580C', // 5 Solid Orange
  6: '#16A34A', // 6 Solid Green
  7: '#831843', // 7 Solid Maroon
  8: '#111827', // 8 Black
  9: '#FBBF24', // 9 Stripe Yellow
  10: '#2563EB', // 10 Stripe Blue
  11: '#DC2626', // 11 Stripe Red
  12: '#7C3AED', // 12 Stripe Purple
  13: '#EA580C', // 13 Stripe Orange
  14: '#16A34A', // 14 Stripe Green
  15: '#831843', // 15 Stripe Maroon
};

export const createInitialPoolBalls = (): PoolBallState[] => {
  const balls: PoolBallState[] = [];

  // Cue ball at head string
  balls.push({
    id: 0,
    number: 0,
    x: 200,
    y: TABLE_HEIGHT / 2,
    vx: 0,
    vy: 0,
    isPocketed: false,
    type: 'cue',
    color: BALL_COLORS[0],
  });

  // 15 Object balls arranged in standard triangular rack
  // Rack order designed so 8-ball is in center (row 3, pos 1)
  const rackOrder = [
    1,
    9, 2,
    3, 8, 10,
    11, 4, 12, 5,
    6, 13, 7, 14, 15
  ];

  const startX = 560;
  const startY = TABLE_HEIGHT / 2;
  const colSpacing = BALL_RADIUS * Math.sqrt(3) + 0.5;
  const rowSpacing = BALL_RADIUS * 2 + 0.5;

  let ballIdx = 0;
  for (let col = 0; col < 5; col++) {
    const colX = startX + col * colSpacing;
    const colStartY = startY - (col * rowSpacing) / 2;

    for (let row = 0; row <= col; row++) {
      const ballNum = rackOrder[ballIdx++];
      const type = ballNum === 8 ? '8ball' : ballNum <= 7 ? 'solid' : 'stripe';

      balls.push({
        id: ballNum,
        number: ballNum,
        x: colX,
        y: colStartY + row * rowSpacing,
        vx: 0,
        vy: 0,
        isPocketed: false,
        type,
        color: BALL_COLORS[ballNum],
      });
    }
  }

  return balls;
};

export const createInitialPoolGameState = (): PoolGameState => ({
  balls: createInitialPoolBalls(),
  cueBallInHand: false,
  assignedGroups: {},
  breakShotTaken: false,
  lastShotFoul: null,
  winnerReason: null,
});

export const applyShotToBalls = (
  balls: PoolBallState[],
  angle: number,
  powerNormalized: number
): void => {
  const cue = balls.find((b) => b.id === 0);
  if (!cue || cue.isPocketed) return;

  const clampedPower = Math.max(0.05, Math.min(1.0, powerNormalized));
  const maxSpeed = 1600; // pixels per second
  const speed = maxSpeed * clampedPower;

  cue.vx = Math.cos(angle) * speed;
  cue.vy = Math.sin(angle) * speed;
};

export const isTableStationary = (balls: PoolBallState[]): boolean => {
  const velThreshold = 1.5;
  return balls.every(
    (b) => b.isPocketed || (Math.abs(b.vx) < velThreshold && Math.abs(b.vy) < velThreshold)
  );
};

export const stepPhysics = (balls: PoolBallState[], dt: number): void => {
  const substeps = 8;
  const subDt = dt / substeps;
  const restitution = 0.94; // cushion bounce damping
  const friction = 0.985; // rolling resistance per substep

  for (let step = 0; step < substeps; step++) {
    // 1. Move balls and check cushion bounds
    for (const ball of balls) {
      if (ball.isPocketed) continue;

      ball.x += ball.vx * subDt;
      ball.y += ball.vy * subDt;

      // Check pockets
      for (const pocket of POCKETS) {
        const dx = ball.x - pocket.x;
        const dy = ball.y - pocket.y;
        if (dx * dx + dy * dy <= pocket.radius * pocket.radius) {
          ball.isPocketed = true;
          ball.vx = 0;
          ball.vy = 0;
          break;
        }
      }

      if (ball.isPocketed) continue;

      // Cushion collisions
      if (ball.x < PLAYFIELD.left) {
        ball.x = PLAYFIELD.left;
        ball.vx = -ball.vx * restitution;
      } else if (ball.x > PLAYFIELD.right) {
        ball.x = PLAYFIELD.right;
        ball.vx = -ball.vx * restitution;
      }

      if (ball.y < PLAYFIELD.top) {
        ball.y = PLAYFIELD.top;
        ball.vy = -ball.vy * restitution;
      } else if (ball.y > PLAYFIELD.bottom) {
        ball.y = PLAYFIELD.bottom;
        ball.vy = -ball.vy * restitution;
      }

      // Rolling friction
      ball.vx *= friction;
      ball.vy *= friction;

      if (Math.abs(ball.vx) < 0.2) ball.vx = 0;
      if (Math.abs(ball.vy) < 0.2) ball.vy = 0;
    }

    // 2. Ball-to-ball elastic collisions
    for (let i = 0; i < balls.length; i++) {
      const b1 = balls[i];
      if (b1.isPocketed) continue;

      for (let j = i + 1; j < balls.length; j++) {
        const b2 = balls[j];
        if (b2.isPocketed) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = BALL_RADIUS * 2;

        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;

          // Positional overlap resolution
          const overlap = minDist - dist;
          b1.x -= nx * overlap * 0.5;
          b1.y -= ny * overlap * 0.5;
          b2.x += nx * overlap * 0.5;
          b2.y += ny * overlap * 0.5;

          // Normal and tangent relative velocity
          const kx = b1.vx - b2.vx;
          const ky = b1.vy - b2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2; // equal mass

          b1.vx -= p * nx * 0.98;
          b1.vy -= p * ny * 0.98;
          b2.vx += p * nx * 0.98;
          b2.vy += p * ny * 0.98;
        }
      }
    }
  }
};

export interface ShotEvaluation {
  settledState: PoolGameState;
  nextTurnUserId: string;
  winnerUserId: string | null;
  foulMessage: string | null;
}

export const evaluatePoolShot = (
  beforeState: PoolGameState,
  afterBalls: PoolBallState[],
  activeUserId: string,
  opponentUserId: string
): ShotEvaluation => {
  const cue = afterBalls.find((b) => b.id === 0);
  const eightBall = afterBalls.find((b) => b.id === 8);

  const newlyPocketed = afterBalls.filter(
    (b) => b.isPocketed && !beforeState.balls.find((ob) => ob.id === b.id)?.isPocketed
  );

  let scratch = false;
  if (!cue || cue.isPocketed) {
    scratch = true;
    // Respot cue ball for ball in hand
    if (cue) {
      cue.isPocketed = false;
      cue.x = 200;
      cue.y = TABLE_HEIGHT / 2;
      cue.vx = 0;
      cue.vy = 0;
    }
  }

  const assignedGroups = { ...beforeState.assignedGroups };
  let myGroup: BallGroup | undefined = assignedGroups[activeUserId];
  let foulMessage: string | null = null;
  let winnerUserId: string | null = null;
  let winnerReason: string | null = null;

  // 1. Check 8-ball outcome
  const eightBallPotted = newlyPocketed.some((b) => b.id === 8);
  if (eightBallPotted) {
    if (scratch) {
      // Pocketing 8-ball on scratch is a loss
      winnerUserId = opponentUserId;
      winnerReason = 'Cue ball scratch while pocketing 8-ball';
    } else if (!myGroup) {
      // 8-ball potted before groups assigned is a loss
      winnerUserId = opponentUserId;
      winnerReason = '8-ball pocketed illegally before clearing suit';
    } else {
      // Check if player cleared all of their group balls
      const remainingGroupBalls = afterBalls.filter(
        (b) => b.type === (myGroup === 'solids' ? 'solid' : 'stripe') && !b.isPocketed
      );
      if (remainingGroupBalls.length === 0) {
        winnerUserId = activeUserId;
        winnerReason = 'Legally pocketed 8-ball to win the match!';
      } else {
        winnerUserId = opponentUserId;
        winnerReason = '8-ball pocketed prematurely before clearing remaining balls';
      }
    }
  }

  // 2. Assign groups if not yet assigned
  if (!myGroup && !eightBallPotted && !scratch) {
    const firstLegal = newlyPocketed.find((b) => b.type === 'solid' || b.type === 'stripe');
    if (firstLegal) {
      const chosenGroup: BallGroup = firstLegal.type === 'solid' ? 'solids' : 'stripes';
      const otherGroup: BallGroup = chosenGroup === 'solids' ? 'stripes' : 'solids';
      assignedGroups[activeUserId] = chosenGroup;
      assignedGroups[opponentUserId] = otherGroup;
      myGroup = chosenGroup;
    }
  }

  // 3. Determine turn retention or foul
  let retainTurn = false;
  if (scratch) {
    foulMessage = 'Scratch! Ball-in-hand awarded to opponent.';
    retainTurn = false;
  } else if (!winnerUserId) {
    if (myGroup) {
      const pottedMyGroup = newlyPocketed.some(
        (b) => b.type === (myGroup === 'solids' ? 'solid' : 'stripe')
      );
      if (pottedMyGroup) {
        retainTurn = true;
      }
    } else if (newlyPocketed.length > 0 && !newlyPocketed.some((b) => b.id === 0 || b.id === 8)) {
      retainTurn = true;
    }
  }

  const nextTurnUserId = winnerUserId
    ? activeUserId
    : retainTurn
    ? activeUserId
    : opponentUserId;

  const settledState: PoolGameState = {
    balls: afterBalls,
    cueBallInHand: scratch,
    assignedGroups,
    breakShotTaken: true,
    lastShotFoul: foulMessage,
    winnerReason,
  };

  return {
    settledState,
    nextTurnUserId,
    winnerUserId,
    foulMessage,
  };
};
