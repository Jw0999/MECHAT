import type { TriviaQuestion } from '@/types/games.types';

export const TRIVIA_QUESTIONS_POOL: TriviaQuestion[] = [
  {
    id: 't-1',
    category: 'Music & Culture',
    question: 'Which Nigerian artist won a Grammy Award for the album "Twice as Tall"?',
    options: ['Wizkid', 'Burna Boy', 'Davido', 'Tiwa Savage'],
    correctIndex: 1,
  },
  {
    id: 't-2',
    category: 'Football & Sports',
    question: 'Who is the all-time top goalscorer in the UEFA Champions League?',
    options: ['Lionel Messi', 'Cristiano Ronaldo', 'Robert Lewandowski', 'Karim Benzema'],
    correctIndex: 1,
  },
  {
    id: 't-3',
    category: 'Tech & Gadgets',
    question: 'What does "PWA" stand for in modern web applications?',
    options: ['Public Web Architecture', 'Progressive Web App', 'Personal Wireless Access', 'Programmed Web Algorithm'],
    correctIndex: 1,
  },
  {
    id: 't-4',
    category: 'Geography & Places',
    question: 'What is the commercial capital and most populous city in Nigeria?',
    options: ['Abuja', 'Kano', 'Lagos', 'Port Harcourt'],
    correctIndex: 2,
  },
  {
    id: 't-5',
    category: 'Football & Sports',
    question: 'Which country won the FIFA Men\'s World Cup in Qatar in 2022?',
    options: ['France', 'Brazil', 'Argentina', 'Croatia'],
    correctIndex: 2,
  },
  {
    id: 't-6',
    category: 'General Knowledge',
    question: 'Which chemical element has the atomic symbol "Au"?',
    options: ['Silver', 'Gold', 'Copper', 'Aluminum'],
    correctIndex: 1,
  },
  {
    id: 't-7',
    category: 'Film & Media',
    question: 'What is the popular nickname given to the Nigerian film industry?',
    options: ['Bollywood', 'Nollywood', 'Hollywood', 'Gollywood'],
    correctIndex: 1,
  },
  {
    id: 't-8',
    category: 'Tech & Gaming',
    question: 'Which programming language is Vite and React primarily written and compiled in?',
    options: ['Python', 'TypeScript / JavaScript', 'Java', 'C#'],
    correctIndex: 1,
  },
  {
    id: 't-9',
    category: 'Science & Nature',
    question: 'What is the largest planet in our solar system?',
    options: ['Saturn', 'Jupiter', 'Neptune', 'Mars'],
    correctIndex: 1,
  },
  {
    id: 't-10',
    category: 'Music & Culture',
    question: 'Which Afrobeats superstar released the viral worldwide hit "Calm Down"?',
    options: ['Rema', 'Asake', 'Omah Lay', 'Fireboy DML'],
    correctIndex: 0,
  },
  {
    id: 't-11',
    category: 'Football & Sports',
    question: 'Which club won the Premier League unbeaten in the 2003-2004 "Invincibles" season?',
    options: ['Manchester United', 'Chelsea', 'Arsenal', 'Liverpool'],
    correctIndex: 2,
  },
  {
    id: 't-12',
    category: 'General Knowledge',
    question: 'How many cards are typically in a standard Naija Whot card deck?',
    options: ['52', '54', '40', '60'],
    correctIndex: 1,
  },
];

export const getRandomTriviaQuestions = (count: number = 5): TriviaQuestion[] => {
  const shuffled = [...TRIVIA_QUESTIONS_POOL].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
