import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Copy, Check, RotateCcw, Trophy, Timer, Users, Award, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { gameRoomService } from '../services/gameRoomService';
import { createInitialTriviaState } from './triviaRules';
import type { GameRoom, TriviaGameState } from '@/types/games.types';
import { cn, getInitials } from '@/lib/utils';
import { soundEffects } from '@/lib/audio/soundEffects';

interface TriviaGameScreenProps {
  initialRoom: GameRoom;
  onExit: () => void;
}

export const TriviaGameScreen: React.FC<TriviaGameScreenProps> = ({ initialRoom, onExit }) => {
  const [room, setRoom] = useState<GameRoom>(initialRoom);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUserId = useAuthStore((s) => s.user?.id) || 'demo-user-1';
  const triviaState: TriviaGameState = room.game_state;

  const currentQuestion = triviaState?.questions?.[triviaState.currentQuestionIndex];
  const totalQuestions = triviaState?.questions?.length || 5;
  const isHost = room.host_user_id === currentUserId;
  const isGameOver = triviaState?.completed || room.status === 'completed';

  const myPlayer = triviaState?.players?.find((p) => p.user_id === currentUserId);
  const hasAnswered = selectedOption !== null || myPlayer?.selectedOptionIndex != null;

  // Real-time timer tick
  useEffect(() => {
    if (isGameOver || !currentQuestion) return;

    setTimeLeft(15);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto advance if host
          if (isHost && !isGameOver) {
            handleNextQuestion();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [triviaState?.currentQuestionIndex, isGameOver, isHost]);

  // Winner confetti
  useEffect(() => {
    if (isGameOver && room.winner_user_id === currentUserId) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899'],
        });
      } catch {}
    }
  }, [isGameOver, room.winner_user_id, currentUserId]);

  // Subscribe to real-time room events
  useEffect(() => {
    const roomKey = room.room_code || room.id;
    const unsubscribe = gameRoomService.subscribeToRoom(
      roomKey,
      (updatedRoom) => {
        setRoom(updatedRoom);
      },
      (event) => {
        if (event === 'trivia:submit-answer') {
          soundEffects.playMessageSound();
        } else if (event === 'trivia:next-question') {
          setSelectedOption(null);
          setTimeLeft(15);
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

  const handleSelectOption = async (index: number) => {
    if (hasAnswered || isSubmitting || isGameOver) return;

    setSelectedOption(index);
    setIsSubmitting(true);
    soundEffects.playMessageSound();

    const timeTakenMs = (15 - timeLeft) * 1000;
    try {
      const roomKey = room.room_code || room.id;
      const updated = await gameRoomService.submitTriviaAnswer(roomKey, index, timeTakenMs);
      setRoom(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = async () => {
    try {
      const roomKey = room.room_code || room.id;
      const updated = await gameRoomService.advanceTriviaQuestion(roomKey);
      setRoom(updated);
      setSelectedOption(null);
      setTimeLeft(15);
    } catch (err: any) {
      console.warn('Next question notice:', err);
    }
  };

  const handleRematch = async () => {
    try {
      const roomKey = room.room_code || room.id;
      const reset = createInitialTriviaState(
        triviaState.players.map((p) => ({
          id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        })),
        triviaState.conversationId
      );
      const updated = await gameRoomService.requestRematch(roomKey, reset);
      setRoom(updated);
      setSelectedOption(null);
      setTimeLeft(15);
      toast.success('New Trivia round started!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to restart trivia');
    }
  };

  const sortedLeaderboard = [...(triviaState?.players || [])].sort((a, b) => b.score - a.score);

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
            {triviaState?.players?.length || 2} Group Players
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

      {/* Main Play Area */}
      <div className="flex-1 flex flex-col p-4 max-w-2xl mx-auto w-full justify-between overflow-y-auto">
        {/* Progress & Timer Bar */}
        <div>
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-bold text-brand uppercase tracking-wider">
              Question {(triviaState?.currentQuestionIndex || 0) + 1} of {totalQuestions}
            </span>
            <div className="flex items-center gap-1.5 font-mono font-bold text-amber-400">
              <Timer size={14} />
              <span>{timeLeft}s</span>
            </div>
          </div>

          {/* Animated Countdown Bar */}
          <div className="w-full h-1.5 rounded-full bg-[#151A1C] overflow-hidden mb-4">
            <div
              className={cn(
                'h-full transition-all duration-1000 ease-linear rounded-full',
                timeLeft > 5 ? 'bg-brand' : 'bg-rose-500'
              )}
              style={{ width: `${(timeLeft / 15) * 100}%` }}
            />
          </div>

          {/* Question Card */}
          {currentQuestion && (
            <div className="p-5 rounded-3xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] shadow-lg mb-4 text-center space-y-2">
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                {currentQuestion.category}
              </span>
              <h2 className="text-base sm:text-lg font-bold leading-relaxed">
                {currentQuestion.question}
              </h2>
            </div>
          )}

          {/* Multiple Choice Options */}
          {currentQuestion && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = selectedOption === idx || myPlayer?.selectedOptionIndex === idx;
                const showResults = hasAnswered || timeLeft === 0;
                const isCorrectOption = idx === currentQuestion.correctIndex;

                let btnStyle = 'border-[#252C2E] bg-[#151A1C] hover:border-brand/50 hover:bg-[#1c2326]';
                if (showResults) {
                  if (isCorrectOption) {
                    btnStyle = 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold';
                  } else if (isSelected) {
                    btnStyle = 'border-rose-500 bg-rose-500/20 text-rose-300 font-bold';
                  } else {
                    btnStyle = 'border-[#252C2E] bg-[#151A1C] opacity-50';
                  }
                } else if (isSelected) {
                  btnStyle = 'border-brand bg-brand/20 text-brand font-bold';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    disabled={hasAnswered || timeLeft === 0 || isSubmitting}
                    className={cn(
                      'p-3.5 rounded-2xl border text-left text-xs sm:text-sm transition-all flex items-center justify-between',
                      btnStyle
                    )}
                  >
                    <span>{opt}</span>
                    {showResults && isCorrectOption && (
                      <Check size={16} className="text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Advance Question Action for Host */}
          {isHost && hasAnswered && !isGameOver && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleNextQuestion}
                className="px-4 py-2 rounded-xl bg-brand text-[#0B0F10] text-xs font-bold hover:bg-brand/90 transition-colors"
              >
                Next Question →
              </button>
            </div>
          )}
        </div>

        {/* Live Leaderboard */}
        <div className="mt-6 p-4 rounded-2xl bg-[#111618] border border-[#252C2E]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#9BA5A8] mb-2 uppercase tracking-wider">
            <Trophy size={14} className="text-amber-400" />
            <span>Group Leaderboard</span>
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {sortedLeaderboard.map((player, rank) => (
              <div
                key={player.user_id}
                className={cn(
                  'flex items-center justify-between p-2 rounded-xl text-xs transition-colors',
                  player.user_id === currentUserId
                    ? 'bg-brand/10 border border-brand/30'
                    : 'bg-[#151A1C]'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold w-4 text-[#9BA5A8]">#{rank + 1}</span>
                  <div className="w-5 h-5 rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center text-[9px] font-bold">
                    {getInitials(player.display_name)}
                  </div>
                  <span className="font-bold truncate max-w-[120px] sm:max-w-[180px]">
                    {player.display_name} {player.user_id === currentUserId && '(You)'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {player.selectedOptionIndex != null && (
                    <span className="text-[10px] text-zinc-400">
                      {player.isCorrect ? '✓ Correct' : '✗ Missed'}
                    </span>
                  )}
                  <span className="font-mono font-black text-brand">{player.score} pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Championship Podium Modal when Completed */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#151A1C] border border-[#252C2E] p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
              <Award size={32} />
            </div>

            <div>
              <h3 className="text-xl font-black tracking-tight text-brand">
                {room.winner_user_id === currentUserId ? '🏆 You Won the Quiz!' : 'Quiz Finished!'}
              </h3>
              <p className="text-xs text-[#9BA5A8] mt-1">
                Winner: {sortedLeaderboard[0]?.display_name} with {sortedLeaderboard[0]?.score} points!
              </p>
            </div>

            {/* Podium Top 3 */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-[#0B0F10] border border-[#252C2E]">
              {sortedLeaderboard.slice(0, 3).map((p, idx) => (
                <div key={p.user_id} className="flex items-center justify-between text-xs py-1">
                  <span className="font-bold">
                    {idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : '🥉 3rd'} {p.display_name}
                  </span>
                  <span className="font-mono font-bold text-amber-400">{p.score} pts</span>
                </div>
              ))}
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

export default TriviaGameScreen;
