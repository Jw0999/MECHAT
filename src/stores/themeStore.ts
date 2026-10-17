import { create } from 'zustand';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
};

const applyThemeToDOM = (resolved: 'dark' | 'light') => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }

  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'dark' ? '#0B0F10' : '#F7F9F5');
  }
};

const initialStoredTheme: Theme =
  typeof window !== 'undefined'
    ? ((localStorage.getItem('mechat_theme') as Theme) || 'dark')
    : 'dark';

const initialResolved: 'dark' | 'light' =
  initialStoredTheme === 'system' ? getSystemTheme() : initialStoredTheme;

applyThemeToDOM(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialStoredTheme,
  resolvedTheme: initialResolved,

  setTheme: (theme: Theme) => {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    localStorage.setItem('mechat_theme', theme);
    applyThemeToDOM(resolved);
    set({ theme, resolvedTheme: resolved });
  },

  toggleTheme: () => {
    const current = get().resolvedTheme;
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));
