import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowLeft, RotateCcw, Copy, Share2, Check, Trophy, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { gameRoomService } from '../services/gameRoomService';
import {
  TABLE_WIDTH,
  TABLE_HEIGHT,
  BALL_RADIUS,
  POCKETS,
  PLAYFIELD,
  createInitialPoolGameState,
  applyShotToBalls,
  stepPhysics,
  isTableStationary,
  evaluatePoolShot,
} from './poolPhysics';
import type { GameRoom, PoolGameState, PoolBallState } from '@/types/games.types';
import { cn, getInitials } from '@/lib/utils';
import { soundEffects } from '@/lib/audio/soundEffects';

interface PoolGameScreenProps {
  initialRoom: GameRoom;
  onExit: () => void;
}

export const PoolGameScreen: React.FC<PoolGameScreenProps> = ({ initialRoom, onExit }) => {
  const [room, setRoom] = useState<GameRoom>(initialRoom);
  const [copied, setCopied] = useState(false);
  const [aimAngle, setAimAngle] = useState(0); // in radians
  const [shotPower, setShotPower] = useState(0.5); // 0.05 to 1.0
  const [isAiming, setIsAiming] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [ballInHandDragging, setBallInHandDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentBallsRef = useRef<PoolBallState[]>([]);
  const lastTimeRef = useRef<number>(0);

  const currentUserId = useAuthStore((s) => s.user?.id) || 'demo-user-1';
  const currentUserProfile = useAuthStore((s) => s.profile);

  const gameState: PoolGameState = room.game_state?.balls
    ? room.game_state
    : createInitialPoolGameState();

  // Sync ref with state
  useEffect(() => {
    currentBallsRef.current = JSON.parse(JSON.stringify(gameState.balls));
  }, [gameState.balls]);

  const isHost = room.host_user_id === currentUserId;
  const isMyTurn = room.status === 'active' && room.current_turn_user_id === currentUserId;
  const opponentProfile = isHost ? room.guest : room.host;
  const opponentId = isHost ? room.guest_user_id || 'guest' : room.host_user_id;

  const myGroup = gameState.assignedGroups?.[currentUserId];
  const opponentGroup = gameState.assignedGroups?.[opponentId];

  const isWinner = room.winner_user_id === currentUserId;
  const isLoser = room.winner_user_id && room.winner_user_id !== currentUserId;

  // Victory celebration
  useEffect(() => {
    if (isWinner) {
      try {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#10b981', '#34d399', '#f59e0b', '#3b82f6'],
        });
      } catch {
        // Safe fallback
      }
    }
  }, [isWinner]);

  // Subscribe to real-time room updates
  useEffect(() => {
    const roomKey = room.room_code || room.id;
    const unsubscribe = gameRoomService.subscribeToRoom(
      roomKey,
      (updatedRoom) => {
        setRoom(updatedRoom);
      },
      (event, payload) => {
        if (event === 'game:shot' && payload?.shotCommand) {
          // Opponent fired a shot! Run physics simulation
          const { cueAngle, shotPower: power } = payload.shotCommand;
          soundEffects.playMessageSound();
          applyShotToBalls(currentBallsRef.current, cueAngle, power);
          setIsSimulating(true);
        } else if (event === 'game:rematch') {
          toast.info('Opponent requested a rematch!');
        } else if (event === 'game:leave') {
          toast.info('Opponent left the match');
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [room.id, room.room_code]);

  // Physics & Animation Loop
  const runPhysicsTick = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = timestamp;

    if (dt > 0) {
      stepPhysics(currentBallsRef.current, dt);
    }

    // Render Canvas frame
    drawTable();

    // Check if table has come to rest
    if (isSimulating && isTableStationary(currentBallsRef.current)) {
      setIsSimulating(false);
      lastTimeRef.current = 0;

      // Authoritative evaluation if I was the player taking the shot
      if (isMyTurn) {
        const evaluation = evaluatePoolShot(
          gameState,
          currentBallsRef.current,
          currentUserId,
          opponentId
        );

        const roomKey = room.room_code || room.id;
        gameRoomService
          .submitPoolSettledState(
            roomKey,
            evaluation.settledState,
            evaluation.nextTurnUserId,
            evaluation.winnerUserId,
            room.state_version
          )
          .then((updated) => setRoom(updated))
          .catch((err) => {
            console.warn('Shot reconciliation notice:', err);
          });
      }
      return;
    }

    animationFrameRef.current = requestAnimationFrame(runPhysicsTick);
  }, [isSimulating, isMyTurn, aimAngle, shotPower, gameState, currentUserId, opponentId, room.id, room.room_code, room.state_version]);

  useEffect(() => {
    lastTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(runPhysicsTick);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSimulating, runPhysicsTick]);

  // Canvas Drawing Routine
  const drawTable = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // 1. Table Outer Wood Rail Frame
    ctx.fillStyle = '#261a12';
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    ctx.fillStyle = '#1c130d';
    ctx.fillRect(4, 4, TABLE_WIDTH - 8, TABLE_HEIGHT - 8);

    // Diamond Sight Inlays on Wood Rails
    ctx.fillStyle = '#d4af37';
    const sightsX = [200, 400, 600];
    const sightsY = [100, 200, 300];
    sightsX.forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, 12, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, TABLE_HEIGHT - 12, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    sightsY.forEach((y) => {
      ctx.beginPath();
      ctx.arc(12, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(TABLE_WIDTH - 12, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Playfield Cushions & Emerald Green Felt
    ctx.fillStyle = '#0f5132'; // Deep cushion green
    ctx.fillRect(PLAYFIELD.left - 8, PLAYFIELD.top - 8, PLAYFIELD.right - PLAYFIELD.left + 16, PLAYFIELD.bottom - PLAYFIELD.top + 16);

    // Felt gradient
    const feltGrad = ctx.createRadialGradient(
      TABLE_WIDTH / 2,
      TABLE_HEIGHT / 2,
      50,
      TABLE_WIDTH / 2,
      TABLE_HEIGHT / 2,
      450
    );
    feltGrad.addColorStop(0, '#198754'); // Lush emerald
    feltGrad.addColorStop(1, '#0e5f39'); // Shadow edge
    ctx.fillStyle = feltGrad;
    ctx.fillRect(PLAYFIELD.left, PLAYFIELD.top, PLAYFIELD.right - PLAYFIELD.left, PLAYFIELD.bottom - PLAYFIELD.top);

    // Head string subtle line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(200, PLAYFIELD.top);
    ctx.lineTo(200, PLAYFIELD.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Pockets
    POCKETS.forEach((pocket) => {
      // Leather pocket border
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius + 3, 0, Math.PI * 2);
      ctx.fill();

      // Deep pocket drop
      ctx.fillStyle = '#050505';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    const balls = currentBallsRef.current;
    const cueBall = balls.find((b) => b.id === 0);

    // 4. Aiming Guide & Cue Stick (only when stationary, my turn, and not simulating)
    if (isMyTurn && !isSimulating && cueBall && !cueBall.isPocketed) {
      const cos = Math.cos(aimAngle);
      const sin = Math.sin(aimAngle);

      // Aiming dotted trajectory line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cueBall.x, cueBall.y);
      ctx.lineTo(cueBall.x + cos * 280, cueBall.y + sin * 280);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ghost cue ball projection indicator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cueBall.x + cos * 80, cueBall.y + sin * 80, BALL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Cue Stick
      const stickDist = 18 + shotPower * 40;
      const stickLen = 220;
      const stickStartX = cueBall.x - cos * stickDist;
      const stickStartY = cueBall.y - sin * stickDist;
      const stickEndX = cueBall.x - cos * (stickDist + stickLen);
      const stickEndY = cueBall.y - sin * (stickDist + stickLen);

      ctx.strokeStyle = '#c28b53'; // Wooden shaft
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(stickStartX, stickStartY);
      ctx.lineTo(stickEndX, stickEndY);
      ctx.stroke();

      // Blue cue tip
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(stickStartX, stickStartY);
      ctx.lineTo(cueBall.x - cos * (stickDist + 6), cueBall.y - sin * (stickDist + 6));
      ctx.stroke();
    }

    // 5. Balls
    balls.forEach((ball) => {
      if (ball.isPocketed) return;

      // Ball shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(ball.x + 2, ball.y + 2, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Ball body
      ctx.fillStyle = ball.color;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Stripe pattern for stripe balls (9-15)
      if (ball.type === 'stripe') {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS * 0.72, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = ball.color;
        ctx.beginPath();
        ctx.rect(ball.x - BALL_RADIUS, ball.y - 3.5, BALL_RADIUS * 2, 7);
        ctx.fill();
      }

      // Ball specular shine (3D sphere effect)
      const shineGrad = ctx.createRadialGradient(
        ball.x - 3,
        ball.y - 3,
        1,
        ball.x,
        ball.y,
        BALL_RADIUS
      );
      shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
      shineGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      shineGrad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
      ctx.fillStyle = shineGrad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Ball number circle
      if (ball.id > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 4.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#111827';
        ctx.font = 'bold 5.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ball.number.toString(), ball.x, ball.y);
      }
    });
  };

  // Touch & Mouse Pointer Aiming Controls
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || isSimulating) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const cueBall = currentBallsRef.current.find((b) => b.id === 0);
    if (!cueBall) return;

    // Ball-in-hand repositioning
    if (gameState.cueBallInHand) {
      setBallInHandDragging(true);
      cueBall.x = Math.max(PLAYFIELD.left, Math.min(PLAYFIELD.right, px));
      cueBall.y = Math.max(PLAYFIELD.top, Math.min(PLAYFIELD.bottom, py));
      drawTable();
      return;
    }

    setIsAiming(true);
    const angle = Math.atan2(py - cueBall.y, px - cueBall.x);
    setAimAngle(angle);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const cueBall = currentBallsRef.current.find((b) => b.id === 0);
    if (!cueBall) return;

    if (ballInHandDragging) {
      cueBall.x = Math.max(PLAYFIELD.left, Math.min(PLAYFIELD.right, px));
      cueBall.y = Math.max(PLAYFIELD.top, Math.min(PLAYFIELD.bottom, py));
      drawTable();
      return;
    }

    if (isAiming) {
      const angle = Math.atan2(py - cueBall.y, px - cueBall.x);
      setAimAngle(angle);
      drawTable();
    }
  };

  const handlePointerUp = () => {
    setIsAiming(false);
    setBallInHandDragging(false);
  };

  const handleTakeShot = () => {
    if (!isMyTurn || isSimulating) return;

    soundEffects.playMessageSound();
    setIsSimulating(true);
    applyShotToBalls(currentBallsRef.current, aimAngle, shotPower);

    const roomKey = room.room_code || room.id;
    gameRoomService.broadcastPoolShot(roomKey, {
      cueAngle: aimAngle,
      shotPower,
      stateVersion: room.state_version,
    });
  };

  const handleCopyCode = useCallback(() => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(room.room_code);
      setCopied(true);
      toast.success('Room code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [room.room_code]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Play 8-Ball Pool on MeChat',
          text: `Join my 8-Ball Pool match on MeChat! Room code: ${room.room_code}`,
          url: window.location.href,
        });
      } catch {
        handleCopyCode();
      }
    } else {
      handleCopyCode();
    }
  }, [room.room_code, handleCopyCode]);

  const handleRematch = async () => {
    try {
      const roomKey = room.room_code || room.id;
      const resetState = createInitialPoolGameState();
      const updated = await gameRoomService.requestRematch(roomKey, resetState);
      setRoom(updated);
      currentBallsRef.current = JSON.parse(JSON.stringify(resetState.balls));
      drawTable();
      if (updated.status === 'active') {
        toast.success('Rematch started!');
      } else {
        toast.info('Rematch requested. Waiting for opponent...');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to request rematch');
    }
  };

  const handleLeave = async () => {
    try {
      const roomKey = room.room_code || room.id;
      await gameRoomService.leaveRoom(roomKey);
    } finally {
      onExit();
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
        <button
          onClick={handleLeave}
          className="flex items-center gap-2 text-sm text-[#9BA5A8] hover:text-[#F5F7F7] dark:hover:text-[#F5F7F7] light:hover:text-[#171B18] transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="font-semibold">Exit</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider font-mono text-[#9BA5A8]">Room</span>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-xs font-mono font-bold text-brand hover:border-brand/40 transition-colors"
          >
            <span>{room.room_code}</span>
            {copied ? <Check size={12} className="text-brand" /> : <Copy size={12} />}
          </button>
          <button
            onClick={handleShare}
            aria-label="Share room invitation"
            className="p-1 rounded-lg hover:bg-[#151A1C] text-[#9BA5A8] hover:text-white transition-colors"
          >
            <Share2 size={16} />
          </button>
        </div>
      </header>

      {/* Waiting for Opponent Screen */}
      {room.status === 'waiting' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand animate-pulse">
            <span className="text-2xl font-black">8</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight">Waiting for opponent to join</h2>
            <p className="text-sm text-[#9BA5A8] max-w-xs mx-auto">
              Share the room code with your friend on MeChat to start the 8-Ball Pool match.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] flex items-center gap-4">
            <span className="font-mono text-2xl font-black tracking-widest text-brand">
              {room.room_code}
            </span>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-xl bg-brand text-[#0B0F10] text-xs font-bold hover:bg-brand/90 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>

          <button
            onClick={handleLeave}
            className="px-4 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
          >
            Cancel Room
          </button>
        </div>
      ) : (
        /* Active / Completed Match */
        <div className="flex-1 flex flex-col items-center justify-between p-2 sm:p-4 overflow-y-auto">
          {/* Players Scoreboard */}
          <div className="w-full max-w-2xl grid grid-cols-2 gap-2 sm:gap-3 mb-2">
            {/* You */}
            <div
              className={cn(
                'flex items-center gap-2 sm:gap-3 p-2.5 rounded-2xl border transition-all',
                isMyTurn
                  ? 'border-brand bg-brand/10 shadow-lg shadow-brand/10'
                  : 'border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF]'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                {currentUserProfile?.display_name ? getInitials(currentUserProfile.display_name) : 'ME'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">
                  {currentUserProfile?.display_name || 'You'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase">
                    {myGroup ? myGroup : 'Suit Open'}
                  </span>
                  {isMyTurn && (
                    <span className="text-[10px] font-semibold text-brand animate-pulse">Your Turn</span>
                  )}
                </div>
              </div>
            </div>

            {/* Opponent */}
            <div
              className={cn(
                'flex items-center gap-2 sm:gap-3 p-2.5 rounded-2xl border transition-all',
                !isMyTurn && room.status === 'active'
                  ? 'border-brand bg-brand/10 shadow-lg shadow-brand/10'
                  : 'border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF]'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center font-bold text-xs shrink-0">
                {opponentProfile?.display_name ? getInitials(opponentProfile.display_name) : 'OP'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">
                  {opponentProfile?.display_name || 'Opponent'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase">
                    {opponentGroup ? opponentGroup : 'Suit Open'}
                  </span>
                  {!isMyTurn && room.status === 'active' && (
                    <span className="text-[10px] font-semibold text-zinc-400">Aiming...</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Foul / Ball-in-Hand Alert */}
          {gameState.cueBallInHand && isMyTurn && (
            <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
              <AlertCircle size={14} />
              <span>Ball-in-hand: Drag cue ball anywhere on table to place it.</span>
            </div>
          )}

          {/* Responsive Pool Canvas Container */}
          <div className="relative w-full max-w-2xl aspect-[2/1] rounded-2xl overflow-hidden shadow-2xl border-2 border-[#3d2719]">
            <canvas
              ref={canvasRef}
              width={TABLE_WIDTH}
              height={TABLE_HEIGHT}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="w-full h-full touch-none cursor-crosshair"
            />
          </div>

          {/* Shot Power & Shoot Controls */}
          {room.status === 'active' && (
            <div className="w-full max-w-2xl mt-3 flex items-center justify-between gap-4 p-3 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
              <div className="flex-1 flex items-center gap-3">
                <span className="text-xs font-semibold text-[#9BA5A8]">Power:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={shotPower}
                  disabled={!isMyTurn || isSimulating}
                  onChange={(e) => {
                    setShotPower(parseFloat(e.target.value));
                    drawTable();
                  }}
                  className="w-full accent-brand h-2 bg-[#252C2E] rounded-lg cursor-pointer"
                />
                <span className="font-mono text-xs font-bold w-10 text-right">
                  {Math.round(shotPower * 100)}%
                </span>
              </div>

              <button
                onClick={handleTakeShot}
                disabled={!isMyTurn || isSimulating}
                className={cn(
                  'px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md',
                  isMyTurn && !isSimulating
                    ? 'bg-brand text-[#0B0F10] hover:bg-brand/90 active:scale-95 shadow-brand/20'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                )}
              >
                {isSimulating ? 'Rolling...' : isMyTurn ? 'Strike' : "Opponent's Turn"}
              </button>
            </div>
          )}

          {/* Outcome Modal / Banner */}
          {room.status === 'completed' && (
            <div className="w-full max-w-sm mt-4 p-4 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                {isWinner ? (
                  <>
                    <Trophy size={20} className="text-brand animate-bounce" />
                    <span className="font-bold text-brand">Victory! You cleared the table!</span>
                  </>
                ) : (
                  <span className="font-bold text-zinc-400">Opponent won this game</span>
                )}
              </div>
              {gameState.winnerReason && (
                <p className="text-xs text-[#9BA5A8]">{gameState.winnerReason}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleRematch}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand text-[#0B0F10] font-bold text-sm hover:bg-brand/90 transition-colors"
                >
                  <RotateCcw size={16} />
                  <span>
                    {room.rematch_requested_by && room.rematch_requested_by !== currentUserId
                      ? 'Accept Rematch'
                      : 'Rematch'}
                  </span>
                </button>

                <button
                  onClick={handleLeave}
                  className="py-2.5 px-4 rounded-xl border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-sm font-semibold text-[#9BA5A8] hover:text-white transition-colors"
                >
                  Leave
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PoolGameScreen;
