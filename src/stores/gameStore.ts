import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
      storage: createJSONStorage(() => ({
        getItem: (name: string) => (typeof window !== 'undefined' ? window.localStorage.getItem(name) : null),
        setItem: (name: string, value: string) => {
          if (typeof window !== 'undefined') window.localStorage.setItem(name, value);
        },
        removeItem: (name: string) => {
          if (typeof window !== 'undefined') window.localStorage.removeItem(name);
        },
      })),
    }
  )
);
