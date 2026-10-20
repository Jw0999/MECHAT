import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameRoom } from '@/types/games.types';

interface GameState {
  activeRoom: GameRoom | null;
  setActiveRoom: (room: GameRoom | null) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      activeRoom: null,
      setActiveRoom: (room) => set({ activeRoom: room }),
      selectedGroupId: '',
      setSelectedGroupId: (id) => set({ selectedGroupId: id }),
    }),
    {
      name: 'mechat-game-storage',
    }
  )
);
