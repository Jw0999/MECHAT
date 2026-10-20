import { create } from 'zustand';
import type { NavTab } from '@/features/shell/BottomNav';

interface NavigationState {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentTab: 'chat',
  setCurrentTab: (tab: NavTab) => set({ currentTab: tab }),
}));
