import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Copy, Check, RotateCcw, Sparkles, AlertCircle, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { gameRoomService } from '../services/gameRoomService';
import { isValidWhotMove, createInitialWhotGameState } from './whotRules';
import type { GameRoom, WhotCard, WhotGameState, WhotShape } from '@/types/games.types';
import { cn, getInitials } from '@/lib/utils';
import { soundEffects } from '@/lib/audio/soundEffects';

interface WhotGameScreenProps {
  initialRoom: GameRoom;
  onExit: () => void;
}

const SHAPE_SYMBOLS: Record<WhotShape, string> = {
  circle: '●',
  triangle: '▲',
  cross: '✚',
  square: '■',
  star: '★',
  whot: 'W',
};

const SHAPE_COLORS: Record<WhotShape, string> = {
  circle: 'text-amber-400 border-amber-400/40 bg-amber-400/10',
  triangle: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  cross: 'text-rose-400 border-rose-400/40 bg-rose-400/10',
  square: 'text-blue-400 border-blue-400/40 bg-blue-400/10',
  star: 'text-purple-400 border-purple-400/40 bg-purple-400/10',
  whot: 'text-brand border-brand/50 bg-brand/10',
};

export const WhotGameScreen: React.FC<WhotGameScreenProps> = ({ initialRoom, onExit }) => {
  const [room, setRoom] = useState<GameRoom>(initialRoom);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whotPickerCardId, setWhotPickerCardId] = useState<string | null>(null);

  const currentUserId = useAuthStore((s) => s.user?.id) || 'demo-user-1';
  const whotState: WhotGameState = room.game_state;

  const me = whotState?.players?.find((p) => p.user_id === currentUserId) || {
    user_id: currentUserId,
    display_name: 'You',
    hand: [],
  };

  const opponents = whotState?.players?.filter((p) => p.user_id !== currentUserId) || [];
  const topCard = whotState?.discardPile?.[whotState.discardPile.length - 1];
  const isMyTurn = whotState?.currentTurnUserId === currentUserId;
  const isWinner = room.winner_user_id === currentUserId;
  const isGameOver = room.status === 'completed' || !!room.winner_user_id;

  // Winner celebration confetti
  useEffect(() => {
    if (isWinner) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899'],
        });
      } catch {}
    }
  }, [isWinner]);

  // Subscribe to real-time room events
  useEffect(() => {
    const roomKey = room.room_code || room.id;
    const unsubscribe = gameRoomService.subscribeToRoom(
      roomKey,
      (updatedRoom) => {
        setRoom(updatedRoom);
      },
      (event) => {
        if (event === 'whot:play-card' || event === 'whot:draw-card') {
          soundEffects.playMessageSound();
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [room.id, room.room_code]);

  const handleCopyCode = useCallback(() => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(room.room_code);
      setCopied(true);
      toast.success('Room code copied');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [room.room_code]);

  const handleCardClick = async (card: WhotCard) => {
    if (!isMyTurn || isSubmitting || isGameOver || !topCard) return;

    const isValid = isValidWhotMove(
      card,
      topCard,
      whotState.requestedShape,
      whotState.pendingPickCount
    );

    if (!isValid) {
      toast.error('Cannot play this card! Match shape, number, or Whot 20.');
      return;
    }

    // If card is 20 Whot, prompt user to pick requested shape
    if (card.number === 20 || card.shape === 'whot') {
      setWhotPickerCardId(card.id);
      return;
    }

    await executePlayCard(card.id);
  };

  const executePlayCard = async (cardId: string, chosenShape?: WhotShape) => {
    setIsSubmitting(true);
    setWhotPickerCardId(null);
    try {
      soundEffects.playMessageSound();
      const roomKey = room.room_code || room.id;
      const updated = await gameRoomService.submitWhotMove(roomKey, cardId, chosenShape);
      setRoom(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to play card');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDrawFromMarket = async () => {
    if (!isMyTurn || isSubmitting || isGameOver) return;

    setIsSubmitting(true);
    try {
      soundEffects.playMessageSound();
      const roomKey = room.room_code || room.id;
      const updated = await gameRoomService.submitWhotDraw(roomKey);
      setRoom(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to draw card');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRematch = async () => {
    try {
      const roomKey = room.room_code || room.id;
      const reset = createInitialWhotGameState(
        whotState.players.map((p) => ({
          id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        })),
        whotState.conversationId
      );
      const updated = await gameRoomService.requestRematch(roomKey, reset);
      setRoom(updated);
      toast.success('New Whot round started!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to restart Whot match');
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#9BA5A8] hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Exit</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
            <Users size={12} />
            {whotState?.players?.length || 2} Group Players
          </span>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#151A1C] border border-[#252C2E] text-xs font-mono font-bold text-brand hover:border-brand/40 transition-colors"
          >
            <span>{room.room_code}</span>
            {copied ? <Check size={12} className="text-brand" /> : <Copy size={12} />}
          </button>
        </div>
      </header>

      {/* Opponents Ribbon */}
      <div className="flex items-center justify-center gap-3 py-2 px-4 bg-[#111618] border-b border-[#252C2E] overflow-x-auto">
        {opponents.map((opp) => {
          const isOppTurn = whotState?.currentTurnUserId === opp.user_id;
          return (
            <div
              key={opp.user_id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all shrink-0',
                isOppTurn
                  ? 'border-brand bg-brand/10 shadow-sm shadow-brand/20'
                  : 'border-[#252C2E] bg-[#151A1C]'
              )}
            >
              <div className="w-6 h-6 rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center text-[10px] font-bold">
                {getInitials(opp.display_name)}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold leading-tight">{opp.display_name}</p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#9BA5A8]">{opp.hand?.length || 0} cards</span>
                  {opp.isLastCard && (
                    <span className="text-[9px] font-black text-rose-400 bg-rose-500/20 px-1 rounded animate-pulse">
                      LAST CARD!
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Center Table Playfield */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        {/* Action Notice Toast Banner */}
        {whotState?.activeActionNotice && (
          <div className="mb-4 px-4 py-1.5 rounded-full bg-[#151A1C] border border-[#252C2E] text-xs font-medium text-brand animate-fade-in shadow-md">
            {whotState.activeActionNotice}
          </div>
        )}

        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {/* Draw Pile (Market) */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleDrawFromMarket}
              disabled={!isMyTurn || isSubmitting || isGameOver}
              className={cn(
                'w-24 h-36 rounded-2xl border-2 flex flex-col items-center justify-center transition-all shadow-xl active:scale-95',
                isMyTurn && !isGameOver
                  ? 'border-brand/60 bg-[#162024] hover:border-brand hover:scale-105 cursor-pointer shadow-brand/10'
                  : 'border-[#252C2E] bg-[#151A1C] opacity-70 cursor-not-allowed'
              )}
            >
              <div className="w-10 h-10 rounded-full bg-brand/10 border border-brand/30 text-brand flex items-center justify-center font-black text-sm mb-1">
                WHOT
              </div>
              <span className="text-[11px] font-bold text-zinc-300">MARKET</span>
              <span className="text-[10px] font-mono text-[#9BA5A8]">
                {whotState?.drawPile?.length || 0} left
              </span>
            </button>
            {isMyTurn && (
              <span className="text-[10px] font-bold text-brand animate-pulse">Tap to Draw</span>
            )}
          </div>

          {/* Discard Pile (Call Card) */}
          <div className="flex flex-col items-center gap-1.5">
            {topCard ? (
              <div
                className={cn(
                  'w-24 h-36 rounded-2xl border-2 flex flex-col justify-between p-2.5 transition-all shadow-2xl relative',
                  SHAPE_COLORS[topCard.shape] || 'border-brand/40 bg-[#151A1C]'
                )}
              >
                {/* Top Corner */}
                <div className="flex items-center justify-between text-xs font-black">
                  <span>{topCard.number}</span>
                  <span className="text-sm">{SHAPE_SYMBOLS[topCard.shape]}</span>
                </div>

                {/* Center Symbol */}
                <div className="text-center my-auto">
                  <span className="text-3xl font-black block">{SHAPE_SYMBOLS[topCard.shape]}</span>
                  {topCard.label && (
                    <span className="text-[9px] font-black uppercase tracking-wider block mt-1 text-zinc-200">
                      {topCard.label}
                    </span>
                  )}
                </div>

                {/* Bottom Corner */}
                <div className="flex items-center justify-between text-xs font-black rotate-180">
                  <span>{topCard.number}</span>
                  <span className="text-sm">{SHAPE_SYMBOLS[topCard.shape]}</span>
                </div>
              </div>
            ) : (
              <div className="w-24 h-36 rounded-2xl border-2 border-dashed border-[#252C2E] flex items-center justify-center text-xs text-[#9BA5A8]">
                Empty
              </div>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9BA5A8]">
              Call Card
            </span>
          </div>
        </div>

        {/* Requested Shape Banner (When Whot 20 played) */}
        {whotState?.requestedShape && (
          <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-xl bg-brand/10 border border-brand/30 text-brand text-xs font-bold animate-pulse">
            <Sparkles size={14} />
            <span>Requested Shape: {whotState.requestedShape.toUpperCase()} {SHAPE_SYMBOLS[whotState.requestedShape]}</span>
          </div>
        )}
      </div>

      {/* Player's Hand Area */}
      <footer className="p-3 sm:p-4 bg-[#111618] border-t border-[#252C2E]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold">{me.display_name} (You)</span>
            <span className="text-[11px] text-[#9BA5A8] font-mono">({me.hand?.length || 0} cards)</span>
            {me.hand?.length === 1 && (
              <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded-full animate-bounce">
                LAST CARD!
              </span>
            )}
          </div>
          <span className={cn('text-xs font-bold', isMyTurn ? 'text-brand animate-pulse' : 'text-zinc-500')}>
            {isMyTurn ? '● Your Turn to Play' : "○ Opponent's Turn"}
          </span>
        </div>

        {/* Scrollable Fan of Cards */}
        <div className="flex items-center gap-2 overflow-x-auto py-2 px-1">
          {me.hand?.map((card) => {
            const playable =
              isMyTurn &&
              !isGameOver &&
              topCard &&
              isValidWhotMove(card, topCard, whotState.requestedShape, whotState.pendingPickCount);

            return (
              <button
                key={card.id}
                onClick={() => handleCardClick(card)}
                disabled={!playable || isSubmitting}
                className={cn(
                  'w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 flex flex-col justify-between p-1.5 sm:p-2 transition-all shrink-0',
                  SHAPE_COLORS[card.shape],
                  playable
                    ? 'hover:-translate-y-2 cursor-pointer shadow-lg hover:shadow-brand/20 active:scale-95'
                    : 'opacity-40 grayscale-[40%] cursor-not-allowed'
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>{card.number}</span>
                  <span className="text-xs">{SHAPE_SYMBOLS[card.shape]}</span>
                </div>
                <div className="text-center my-auto">
                  <span className="text-xl sm:text-2xl font-black">{SHAPE_SYMBOLS[card.shape]}</span>
                  {card.label && (
                    <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-tighter block text-zinc-300">
                      {card.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold rotate-180">
                  <span>{card.number}</span>
                  <span className="text-xs">{SHAPE_SYMBOLS[card.shape]}</span>
                </div>
              </button>
            );
          })}
        </div>
      </footer>

      {/* Whot 20 Shape Selection Modal */}
      {whotPickerCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xs rounded-3xl bg-[#151A1C] border border-[#252C2E] p-5 text-center space-y-4">
            <h3 className="font-bold text-base">You played Whot 20!</h3>
            <p className="text-xs text-[#9BA5A8]">Pick the required shape for the next player:</p>
            <div className="grid grid-cols-5 gap-2">
              {(['circle', 'triangle', 'cross', 'square', 'star'] as WhotShape[]).map((shape) => (
                <button
                  key={shape}
                  onClick={() => executePlayCard(whotPickerCardId, shape)}
                  className={cn(
                    'p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all',
                    SHAPE_COLORS[shape]
                  )}
                >
                  <span className="text-2xl font-black">{SHAPE_SYMBOLS[shape]}</span>
                  <span className="text-[9px] font-bold uppercase">{shape}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Over / Winner Banner */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#151A1C] border border-[#252C2E] p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-brand/10 border border-brand/30 mx-auto flex items-center justify-center text-brand">
              <Sparkles size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-brand">
                {isWinner ? 'CHECK! YOU WON!' : 'GAME OVER!'}
              </h3>
              <p className="text-xs text-[#9BA5A8] mt-1">{whotState.winnerReason}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleRematch}
                className="flex-1 py-2.5 px-4 rounded-xl bg-brand text-[#0B0F10] font-bold text-sm hover:bg-brand/90 transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={16} />
                <span>Play Again</span>
              </button>
              <button
                onClick={onExit}
                className="py-2.5 px-4 rounded-xl border border-[#252C2E] text-sm font-semibold text-[#9BA5A8] hover:text-white transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhotGameScreen;
