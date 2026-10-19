import { describe, it, expect } from 'bun:test';
import {
  createInitialTriviaState,
  submitTriviaAnswer,
  advanceTriviaQuestion,
} from '../src/features/games/trivia/triviaRules';
import { TRIVIA_QUESTIONS_POOL, getRandomTriviaQuestions } from '../src/features/games/trivia/triviaData';

describe('Trivia Clash (Group Quiz Showdown) Rules & Mechanics', () => {
  it('loads questions pool and randomly selects required question count', () => {
    expect(TRIVIA_QUESTIONS_POOL.length).toBeGreaterThanOrEqual(10);

    const questions = getRandomTriviaQuestions(5);
    expect(questions.length).toBe(5);
    questions.forEach((q) => {
      expect(q.options.length).toBe(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
    });
  });

  it('initializes game state with group members and 15s timer', () => {
    const members = [
      { id: 'user-1', display_name: 'Kelvin' },
      { id: 'user-2', display_name: 'Amara' },
    ];
    const state = createInitialTriviaState(members, 'conv-group-42');

    expect(state.players.length).toBe(2);
    expect(state.timeLimitSeconds).toBe(15);
    expect(state.completed).toBe(false);
    expect(state.winnerUserId).toBeNull();
  });

  it('awards score with speed bonus for correct answers and zero for incorrect answers', () => {
    const members = [
      { id: 'user-1', display_name: 'Kelvin' },
      { id: 'user-2', display_name: 'Amara' },
    ];
    const state = createInitialTriviaState(members);
    const correctIdx = state.questions[0].correctIndex;
    const wrongIdx = (correctIdx + 1) % 4;

    // Kelvin answers correctly fast (within 3 seconds / 3000ms)
    const afterKelvin = submitTriviaAnswer(state, 'user-1', correctIdx, 3000);
    const kelvinScore = afterKelvin.players.find((p) => p.user_id === 'user-1')!.score;
    expect(kelvinScore).toBeGreaterThan(500); // 500 base + speed bonus

    // Amara answers incorrectly
    const afterAmara = submitTriviaAnswer(afterKelvin, 'user-2', wrongIdx, 4000);
    const amaraScore = afterAmara.players.find((p) => p.user_id === 'user-2')!.score;
    expect(amaraScore).toBe(0);
  });

  it('advances questions and declares winner upon quiz completion', () => {
    const members = [
      { id: 'user-1', display_name: 'Kelvin' },
      { id: 'user-2', display_name: 'Amara' },
    ];
    let state = createInitialTriviaState(members);
    // Force only 2 questions for quick test
    state.questions = state.questions.slice(0, 2);

    // Question 1
    state = submitTriviaAnswer(state, 'user-1', state.questions[0].correctIndex, 2000);
    state = advanceTriviaQuestion(state);
    expect(state.currentQuestionIndex).toBe(1);
    expect(state.completed).toBe(false);

    // Question 2 (final question)
    state = submitTriviaAnswer(state, 'user-1', state.questions[1].correctIndex, 2000);
    state = advanceTriviaQuestion(state);

    expect(state.completed).toBe(true);
    expect(state.winnerUserId).toBe('user-1');
  });
});
