import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Profile, UserSettings } from '@/types/database.types';
import { toast } from 'sonner';

interface AuthState {
  user: any | null;
  profile: Profile | null;
  settings: UserSettings | null;
  isLoading: boolean;
  isConfigured: boolean;
  isDemoMode: boolean;
  initAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    displayName: string,
    username: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
  uploadAvatar: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  enableDemoMode: (presetIndex?: number) => void;
}

// Realistic demo profiles for testing when offline or unconfigured
export const DEMO_PROFILES: Profile[] = [
  {
    id: 'demo-user-1',
    username: 'danangcalvin',
    display_name: 'Danang Calvin',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bio: 'Product designer & tech enthusiast 🚀',
    online_status: 'online',
    last_seen: new Date().toISOString(),
    privacy_online: true,
    privacy_last_seen: true,
    privacy_read_receipts: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-user-2',
    username: 'ninaflora',
    display_name: 'Nina Flora',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    bio: 'Coffee lover & UI/UX explorer ☕️✨',
    online_status: 'online',
    last_seen: new Date().toISOString(),
    privacy_online: true,
    privacy_last_seen: true,
    privacy_read_receipts: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEFAULT_SETTINGS: UserSettings = {
  user_id: 'default',
  theme: 'dark',
  notifications_enabled: true,
  sound_enabled: true,
  read_receipts: true,
  presence_visible: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const safeStorage = {
  get: (key: string): string | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  set: (key: string, val: string) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
    } catch {}
  },
  remove: (key: string) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {}
  },
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  isConfigured: isSupabaseConfigured(),
  isDemoMode: false,

  initAuth: async () => {
    const configured = isSupabaseConfigured();
    set({ isConfigured: configured });

    if (configured) {
      // In real Supabase mode: ensure demo user data is cleared
      safeStorage.remove('mechat_demo_user');
    } else {
      // Fallback preview mode when keys are not configured yet
      const savedDemo = safeStorage.get('mechat_demo_user');
      if (savedDemo) {
        try {
          const parsed = JSON.parse(savedDemo);
          set({
            user: { id: parsed.id, email: `${parsed.username}@mechat.app` },
            profile: parsed,
            settings: { ...DEFAULT_SETTINGS, user_id: parsed.id },
            isDemoMode: true,
            isLoading: false,
          });
          return;
        } catch (e) {
          safeStorage.remove('mechat_demo_user');
        }
      }

      set({ isLoading: false });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const { data: settings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        set({
          user: session.user,
          profile: profile || null,
          settings: settings || DEFAULT_SETTINGS,
          isLoading: false,
          isDemoMode: false,
        });
      } else {
        set({ user: null, profile: null, isLoading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          set({
            user: session.user,
            profile: profile || null,
            isLoading: false,
            isDemoMode: false,
          });
        } else {
          set({ user: null, profile: null, isLoading: false });
        }
      });
    } catch (err) {
      console.error('Error initializing auth:', err);
      set({ isLoading: false });
    }
  },

  enableDemoMode: (presetIndex = 0) => {
    const chosenProfile = DEMO_PROFILES[presetIndex] || DEMO_PROFILES[0];
    safeStorage.set('mechat_demo_user', JSON.stringify(chosenProfile));
    set({
      user: { id: chosenProfile.id, email: `${chosenProfile.username}@mechat.app` },
      profile: chosenProfile,
      settings: { ...DEFAULT_SETTINGS, user_id: chosenProfile.id },
      isDemoMode: true,
      isLoading: false,
    });
    toast.success(`Welcome, ${chosenProfile.display_name}! (Interactive Demo Mode)`);
  },

  login: async (email, password) => {
    if (!get().isConfigured) {
      // In demo/unconfigured mode, offer instant demo login
      get().enableDemoMode(0);
      return { success: true };
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ isLoading: false });
        return { success: false, error: error.message };
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        set({
          user: data.user,
          profile: profile || null,
          isLoading: false,
          isDemoMode: false,
        });
      }

      return { success: true };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err.message || 'Login failed' };
    }
  },

  register: async (email, password, displayName, username) => {
    if (!get().isConfigured) {
      // Auto create demo profile in demo mode
      const newDemoProfile: Profile = {
        id: `demo-user-${Date.now()}`,
        username,
        display_name: displayName,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        bio: 'Hey there! I am using MeChat.',
        online_status: 'online',
        last_seen: new Date().toISOString(),
        privacy_online: true,
        privacy_last_seen: true,
        privacy_read_receipts: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      safeStorage.set('mechat_demo_user', JSON.stringify(newDemoProfile));
      set({
        user: { id: newDemoProfile.id, email },
        profile: newDemoProfile,
        isDemoMode: true,
        isLoading: false,
      });
      return { success: true };
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: displayName,
            name: displayName,
            username: username,
          },
        },
      });

      if (error) {
        set({ isLoading: false });
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Manually ensure profile is created if trigger has delay
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        set({
          user: data.user,
          profile: profile || null,
          isLoading: false,
          isDemoMode: false,
        });
      }

      return { success: true };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err.message || 'Registration failed' };
    }
  },

  logout: async () => {
    safeStorage.remove('mechat_demo_user');
    if (get().isConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    set({ user: null, profile: null, isDemoMode: false });
    toast.info('Logged out successfully');
  },

  updateProfile: async (updates) => {
    const { profile, isDemoMode, isConfigured } = get();
    if (!profile) return { success: false, error: 'No profile' };

    const updatedProfile = { ...profile, ...updates, updated_at: new Date().toISOString() };

    if (isDemoMode || !isConfigured) {
      safeStorage.set('mechat_demo_user', JSON.stringify(updatedProfile));
      set({ profile: updatedProfile });
      toast.success('Profile updated');
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;
      set({ profile: updatedProfile });
      toast.success('Profile updated');
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || 'Could not update profile');
      return { success: false, error: err.message };
    }
  },

  uploadAvatar: async (file: File) => {
    const { profile, isDemoMode, isConfigured } = get();
    if (!profile) return { success: false, error: 'No profile' };

    if (isDemoMode || !isConfigured) {
      // Create local object URL for preview
      const localUrl = URL.createObjectURL(file);
      await get().updateProfile({ avatar_url: localUrl });
      return { success: true, url: localUrl };
    }

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await get().updateProfile({ avatar_url: publicUrl });
      return { success: true, url: publicUrl };
    } catch (err: any) {
      return { success: false, error: err.message || 'Avatar upload failed' };
    }
  },

  updateSettings: async (updates) => {
    const { settings, isDemoMode, isConfigured } = get();
    const updated = { ...(settings || DEFAULT_SETTINGS), ...updates };
    set({ settings: updated });

    if (!isDemoMode && isConfigured && get().user?.id) {
      try {
        await supabase
          .from('user_settings')
          .update(updates)
          .eq('user_id', get().user.id);
      } catch (e) {
        console.error('Settings update error:', e);
      }
    }
    toast.success('Settings saved');
  },
}));
