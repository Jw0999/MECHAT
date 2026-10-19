import type { TriviaGameState, TriviaPlayer } from '@/types/games.types';
import { getRandomTriviaQuestions } from './triviaData';

export const createInitialTriviaState = (
  groupMembers: { id: string; display_name: string; avatar_url?: string | null }[],
  conversationId?: string | null
): TriviaGameState => {
  const questions = getRandomTriviaQuestions(5);
  const players: TriviaPlayer[] = groupMembers.map((m) => ({
    user_id: m.id,
    display_name: m.display_name,
    avatar_url: m.avatar_url,
    score: 0,
    selectedOptionIndex: null,
    answeredAtMs: null,
    isCorrect: null,
  }));

  return {
    questions,
    currentQuestionIndex: 0,
    timeLimitSeconds: 15,
    questionStartedAt: Date.now(),
    players,
    completed: false,
    winnerUserId: null,
    conversationId: conversationId || null,
  };
};

export const submitTriviaAnswer = (
  state: TriviaGameState,
  userId: string,
  optionIndex: number,
  timeTakenMs: number
): TriviaGameState => {
  const currentQ = state.questions[state.currentQuestionIndex];
  if (!currentQ) return state;

  const playerIdx = state.players.findIndex((p) => p.user_id === userId);
  if (playerIdx === -1) return state;

  const isCorrect = optionIndex === currentQ.correctIndex;
  // Score formula: 500 base points for correct + up to 500 points for speed (0 to 15000ms)
  const speedBonus = isCorrect ? Math.max(0, Math.round(500 * (1 - timeTakenMs / 15000))) : 0;
  const earnedPoints = isCorrect ? 500 + speedBonus : 0;

  const nextPlayers = [...state.players];
  const player = nextPlayers[playerIdx];

  nextPlayers[playerIdx] = {
    ...player,
    score: player.score + earnedPoints,
    selectedOptionIndex: optionIndex,
    answeredAtMs: timeTakenMs,
    isCorrect,
  };

  return {
    ...state,
    players: nextPlayers,
  };
};

export const advanceTriviaQuestion = (state: TriviaGameState): TriviaGameState => {
  const nextIdx = state.currentQuestionIndex + 1;
  const isFinished = nextIdx >= state.questions.length;

  let winnerUserId: string | null = null;
  if (isFinished) {
    // Determine player with highest score
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    winnerUserId = sorted[0]?.user_id || null;
  }

  // Reset per-question answers
  const resetPlayers = state.players.map((p) => ({
    ...p,
    selectedOptionIndex: null,
    answeredAtMs: null,
    isCorrect: null,
  }));

  return {
    ...state,
    currentQuestionIndex: isFinished ? state.currentQuestionIndex : nextIdx,
    questionStartedAt: Date.now(),
    players: resetPlayers,
    completed: isFinished,
    winnerUserId,
  };
};
