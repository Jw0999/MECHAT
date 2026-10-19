import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, RotateCcw, Copy, Share2, Check, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { gameRoomService } from '../services/gameRoomService';
import { checkWinner, createInitialTicTacToeState } from './ticTacToeRules';
import type { GameRoom, TicTacToeState } from '@/types/games.types';
import { cn, getInitials } from '@/lib/utils';
import { soundEffects } from '@/lib/audio/soundEffects';

interface TicTacToeGameScreenProps {
  initialRoom: GameRoom;
  onExit: () => void;
}

export const TicTacToeGameScreen: React.FC<TicTacToeGameScreenProps> = ({ initialRoom, onExit }) => {
  const [room, setRoom] = useState<GameRoom>(initialRoom);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id) || 'demo-user-1';
  const currentUserProfile = useAuthStore((s) => s.profile);

  const gameState: TicTacToeState = room.game_state || createInitialTicTacToeState();
  const board = gameState.board || Array(9).fill(null);
  const isHost = room.host_user_id === currentUserId;
  const mySymbol = isHost ? 'X' : 'O';
  const opponentSymbol = isHost ? 'O' : 'X';
  const isMyTurn = room.status === 'active' && room.current_turn_user_id === currentUserId;

  const opponentProfile = isHost ? room.guest : room.host;
  const isWinner = room.winner_user_id === currentUserId;
  const isLoser = room.winner_user_id && room.winner_user_id !== currentUserId;
  const isDraw = gameState.isDraw || (room.status === 'completed' && !room.winner_user_id);

  // Victory celebration trigger
  useEffect(() => {
    if (isWinner) {
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#f59e0b'],
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
        if (event === 'game:move' && payload?.cellIndex !== undefined) {
          soundEffects.playMessageSound();
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

  const handleCellClick = async (index: number) => {
    if (!isMyTurn || isSubmitting || board[index] || room.status !== 'active') return;

    soundEffects.playMessageSound();
    setIsSubmitting(true);

    // Optimistic local update for zero-perceived latency
    const nextBoard = [...board];
    nextBoard[index] = mySymbol;
    const { winner, winningLine, isDraw: draw } = checkWinner(nextBoard);

    setRoom((prev) => ({
      ...prev,
      game_state: {
        board: nextBoard,
        lastMove: index,
        winningLine,
        isDraw: draw,
      },
      current_turn_user_id: winner || draw ? null : isHost ? prev.guest_user_id : prev.host_user_id,
      winner_user_id: winner ? currentUserId : null,
      status: winner || draw ? 'completed' : 'active',
      state_version: prev.state_version + 1,
    }));

    try {
      const roomKey = room.room_code || room.id;
      const updated = await gameRoomService.submitTicTacToeMove(
        roomKey,
        index,
        room.state_version
      );
      setRoom(updated);
    } catch (err: any) {
      console.warn('Move notice:', err);
    } finally {
      setIsSubmitting(false);
    }
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
          title: 'Play Tic-Tac-Toe with me on MeChat',
          text: `Join my Tic-Tac-Toe match on MeChat! Room code: ${room.room_code}`,
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
      const resetState = createInitialTicTacToeState();
      const roomKey = room.room_code || room.id;
      const updated = await gameRoomService.requestRematch(roomKey, resetState);
      setRoom(updated);
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
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
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
            <span className="text-2xl font-black">#</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight">Waiting for opponent to join</h2>
            <p className="text-sm text-[#9BA5A8] max-w-xs mx-auto">
              Share the room code with your friend on MeChat so they can enter and start playing.
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
        <div className="flex-1 flex flex-col items-center justify-between p-4 md:p-8 overflow-y-auto">
          {/* Players Scoreboard Card */}
          <div className="w-full max-w-sm grid grid-cols-2 gap-3">
            {/* You */}
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-2xl border transition-all',
                isMyTurn
                  ? 'border-brand bg-brand/10 shadow-lg shadow-brand/10'
                  : 'border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF]'
              )}
            >
              <div className="w-9 h-9 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                {currentUserProfile?.display_name ? getInitials(currentUserProfile.display_name) : 'ME'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">
                  {currentUserProfile?.display_name || 'You'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn('text-xs font-black', mySymbol === 'X' ? 'text-emerald-400' : 'text-amber-400')}>
                    {mySymbol}
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
                'flex items-center gap-3 p-3 rounded-2xl border transition-all',
                !isMyTurn && room.status === 'active'
                  ? 'border-brand bg-brand/10 shadow-lg shadow-brand/10'
                  : 'border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF]'
              )}
            >
              <div className="w-9 h-9 rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center font-bold text-xs shrink-0">
                {opponentProfile?.display_name ? getInitials(opponentProfile.display_name) : 'OP'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">
                  {opponentProfile?.display_name || 'Opponent'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn('text-xs font-black', opponentSymbol === 'X' ? 'text-emerald-400' : 'text-amber-400')}>
                    {opponentSymbol}
                  </span>
                  {!isMyTurn && room.status === 'active' && (
                    <span className="text-[10px] font-semibold text-zinc-400">Thinking...</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3x3 Interactive Grid Board */}
          <div className="my-auto py-6">
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 w-72 h-72 sm:w-84 sm:h-84">
              {board.map((cell, idx) => {
                const isWinningCell = gameState.winningLine?.includes(idx);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleCellClick(idx)}
                    disabled={Boolean(cell) || !isMyTurn || room.status !== 'active' || isSubmitting}
                    className={cn(
                      'relative flex items-center justify-center rounded-2xl text-4xl sm:text-5xl font-black transition-all duration-150 shadow-md',
                      // Background & Border
                      isWinningCell
                        ? 'bg-brand/20 border-2 border-brand text-brand shadow-brand/30 scale-105 z-10'
                        : cell
                        ? 'bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#D1D8D0]'
                        : 'bg-[#121617] dark:bg-[#121617] light:bg-[#F0F3ED] border border-[#202628] dark:border-[#202628] light:border-[#E0E6DD] hover:border-brand/40 active:scale-95 cursor-pointer',
                      // Disabled state
                      (!isMyTurn || Boolean(cell)) && 'cursor-default'
                    )}
                  >
                    {cell === 'X' && <span className="text-emerald-400">X</span>}
                    {cell === 'O' && <span className="text-amber-400">O</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Outcome & Rematch Controls */}
          <div className="w-full max-w-sm flex flex-col items-center gap-3">
            {room.status === 'completed' && (
              <div className="w-full p-4 rounded-2xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  {isWinner ? (
                    <>
                      <Trophy size={20} className="text-brand animate-bounce" />
                      <span className="font-bold text-brand">Victory! You won!</span>
                    </>
                  ) : isDraw ? (
                    <span className="font-bold text-amber-400">It's a Draw! Well played!</span>
                  ) : (
                    <span className="font-bold text-zinc-400">Opponent won this round</span>
                  )}
                </div>

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
        </div>
      )}
    </div>
  );
};
