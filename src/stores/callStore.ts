import { create } from 'zustand';
import type { CallLog, CallType, CallStatus, Profile } from '@/types/database.types';
import { WebRTCManager } from '@/features/calling/WebRTCManager';
import { useAuthStore } from './authStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { toast } from 'sonner';

export type CallConnectionState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface CallState {
  callHistory: CallLog[];
  activeCall: {
    status: CallConnectionState;
    callType: CallType;
    remoteUser: Profile | null;
    isIncoming: boolean;
    duration: number;
    isMuted: boolean;
    isVideoOff: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
  } | null;
  timerInterval: any | null;
  webrtcManager: WebRTCManager | null;

  initiateCall: (remoteUser: Profile, callType: CallType) => Promise<void>;
  simulateIncomingCall: (fromUser: Profile, callType: CallType) => void;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  loadCallHistory: () => Promise<void>;
}

// Initial realistic call history
const INITIAL_CALL_HISTORY: CallLog[] = [
  {
    id: 'call-1',
    conversation_id: 'conv-nina',
    caller_id: 'demo-user-2',
    receiver_id: 'demo-user-1',
    call_type: 'video',
    status: 'completed',
    duration_seconds: 480, // 8 mins
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    ended_at: new Date(Date.now() - 1000 * 60 * 60 * 3 + 480000).toISOString(),
    caller: {
      id: 'demo-user-2',
      username: 'ninaflora',
      display_name: 'Nina Flora',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      bio: '',
      online_status: 'online',
      last_seen: new Date().toISOString(),
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '',
      updated_at: '',
    },
  },
  {
    id: 'call-2',
    conversation_id: 'conv-danang',
    caller_id: 'demo-user-danang',
    receiver_id: 'demo-user-1',
    call_type: 'audio',
    status: 'missed',
    duration_seconds: 0,
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), // Yesterday
    ended_at: null,
    caller: {
      id: 'demo-user-danang',
      username: 'danangcalvin',
      display_name: 'Danang Calvin',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      bio: '',
      online_status: 'offline',
      last_seen: '',
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '',
      updated_at: '',
    },
  },
  {
    id: 'call-3',
    conversation_id: 'conv-satria',
    caller_id: 'demo-user-1',
    receiver_id: 'demo-user-satria',
    call_type: 'audio',
    status: 'completed',
    duration_seconds: 142, // 2m 22s
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
    ended_at: new Date(Date.now() - 1000 * 60 * 60 * 42 + 142000).toISOString(),
    receiver: {
      id: 'demo-user-satria',
      username: 'satriah',
      display_name: 'Satria herman',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      bio: '',
      online_status: 'online',
      last_seen: '',
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '',
      updated_at: '',
    },
  },
];

export const useCallStore = create<CallState>((set, get) => ({
  callHistory: INITIAL_CALL_HISTORY,
  activeCall: null,
  timerInterval: null,
  webrtcManager: null,

  loadCallHistory: async () => {
    const { isDemoMode, user } = useAuthStore.getState();
    if (isDemoMode || !isSupabaseConfigured() || !user) return;

    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          caller:profiles!caller_id(*),
          receiver:profiles!receiver_id(*)
        `)
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('started_at', { ascending: false });

      if (error) throw error;
      set({ callHistory: (data as any) || INITIAL_CALL_HISTORY });
    } catch (e) {
      console.warn('Could not load call logs:', e);
    }
  },

  initiateCall: async (remoteUser: Profile, callType: CallType) => {
    // Teardown previous
    get().endCall();

    const manager = new WebRTCManager({
      onLocalStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, localStream: stream } } : state));
      },
      onRemoteStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, remoteStream: stream } } : state));
      },
    });

    set({
      webrtcManager: manager,
      activeCall: {
        status: 'calling',
        callType,
        remoteUser,
        isIncoming: false,
        duration: 0,
        isMuted: false,
        isVideoOff: false,
        localStream: null,
        remoteStream: null,
      },
    });

    try {
      await manager.startLocalMedia(callType === 'video');
      manager.initializePeerConnection();

      // Simulated pickup after 2.5s for immediate responsiveness
      setTimeout(() => {
        if (get().activeCall?.status === 'calling') {
          if (callType === 'video' && !manager.hasRemoteTracks()) {
            manager.simulateRemoteStream(remoteUser);
          }

          set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, status: 'connected' } } : state));

          // Start duration timer
          const timer = setInterval(() => {
            set((state) => {
              if (!state.activeCall || state.activeCall.status !== 'connected') return state;
              return { activeCall: { ...state.activeCall, duration: state.activeCall.duration + 1 } };
            });
          }, 1000);

          set({ timerInterval: timer });
        }
      }, 2500);
    } catch (err: any) {
      toast.error('Unable to access camera or microphone');
      get().endCall();
    }
  },

  simulateIncomingCall: (fromUser: Profile, callType: CallType) => {
    get().endCall();
    set({
      activeCall: {
        status: 'ringing',
        callType,
        remoteUser: fromUser,
        isIncoming: true,
        duration: 0,
        isMuted: false,
        isVideoOff: false,
        localStream: null,
        remoteStream: null,
      },
    });
  },

  acceptCall: async () => {
    const { activeCall } = get();
    if (!activeCall || !activeCall.remoteUser) return;

    const manager = new WebRTCManager({
      onLocalStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, localStream: stream } } : state));
      },
      onRemoteStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, remoteStream: stream } } : state));
      },
    });

    set({ webrtcManager: manager });

    try {
      await manager.startLocalMedia(activeCall.callType === 'video');
      manager.initializePeerConnection();

      if (activeCall.callType === 'video' && !manager.hasRemoteTracks()) {
        manager.simulateRemoteStream(activeCall.remoteUser);
      }

      set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, status: 'connected' } } : state));

      const timer = setInterval(() => {
        set((state) => {
          if (!state.activeCall || state.activeCall.status !== 'connected') return state;
          return { activeCall: { ...state.activeCall, duration: state.activeCall.duration + 1 } };
        });
      }, 1000);

      set({ timerInterval: timer });
    } catch (err) {
      toast.error('Failed to connect call');
      get().endCall();
    }
  },

  rejectCall: () => {
    const { activeCall } = get();
    if (activeCall && activeCall.remoteUser) {
      // Record missed/declined call in history
      const newLog: CallLog = {
        id: `call-${Date.now()}`,
        conversation_id: null,
        caller_id: activeCall.remoteUser.id,
        receiver_id: useAuthStore.getState().user?.id || 'demo-user-1',
        call_type: activeCall.callType,
        status: 'declined',
        duration_seconds: 0,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        caller: activeCall.remoteUser,
      };
      set((state) => ({ callHistory: [newLog, ...state.callHistory] }));
    }
    get().endCall();
  },

  endCall: () => {
    const { activeCall, timerInterval, webrtcManager } = get();
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    if (webrtcManager) {
      webrtcManager.stopMedia();
    }

    if (activeCall && activeCall.remoteUser && activeCall.status === 'connected') {
      const newLog: CallLog = {
        id: `call-${Date.now()}`,
        conversation_id: null,
        caller_id: activeCall.isIncoming ? activeCall.remoteUser.id : useAuthStore.getState().user?.id || 'demo-user-1',
        receiver_id: activeCall.isIncoming ? useAuthStore.getState().user?.id || 'demo-user-1' : activeCall.remoteUser.id,
        call_type: activeCall.callType,
        status: 'completed',
        duration_seconds: activeCall.duration,
        started_at: new Date(Date.now() - activeCall.duration * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        caller: activeCall.isIncoming ? activeCall.remoteUser : useAuthStore.getState().profile || undefined,
        receiver: activeCall.isIncoming ? useAuthStore.getState().profile || undefined : activeCall.remoteUser,
      };
      set((state) => ({ callHistory: [newLog, ...state.callHistory] }));
    }

    set({ activeCall: null, timerInterval: null, webrtcManager: null });
  },

  toggleMute: () => {
    const { webrtcManager, activeCall } = get();
    if (webrtcManager && activeCall) {
      const isMuted = webrtcManager.toggleMute();
      set({ activeCall: { ...activeCall, isMuted } });
    }
  },

  toggleVideo: () => {
    const { webrtcManager, activeCall } = get();
    if (webrtcManager && activeCall) {
      const isVideoOff = webrtcManager.toggleVideo();
      set({ activeCall: { ...activeCall, isVideoOff } });
    }
  },
}));
