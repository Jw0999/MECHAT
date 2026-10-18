import { create } from 'zustand';
import type { CallLog, CallType, Profile } from '@/types/database.types';
import { WebRTCManager } from '@/features/calling/WebRTCManager';
import { useAuthStore } from './authStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { toast } from 'sonner';

export type CallConnectionState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export interface GroupParticipant {
  id: string;
  user: Profile;
  stream?: MediaStream | null;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
}

export interface ActiveGroupCall {
  groupId: string;
  groupTitle: string;
  callType: CallType;
  status: 'connecting' | 'connected' | 'ended';
  duration: number;
  isMuted: boolean;
  isVideoOff: boolean;
  localStream: MediaStream | null;
  participants: GroupParticipant[];
}

export interface ActiveCall {
  status: CallConnectionState;
  callType: CallType;
  remoteUser: Profile | null;
  isIncoming: boolean;
  duration: number;
  isMuted: boolean;
  isVideoOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callId?: string;
  conversationId?: string | null;
  sdpOffer?: RTCSessionDescriptionInit | null;
}

interface CallState {
  callHistory: CallLog[];
  activeCall: ActiveCall | null;
  activeGroupCall: ActiveGroupCall | null;
  timerInterval: any | null;
  groupTimerInterval: any | null;
  webrtcManager: WebRTCManager | null;
  groupWebrtcManager: WebRTCManager | null;
  signalingChannel: any | null;
  sessionChannel: any | null;
  groupCallChannel: any | null;

  initCallSignaling: () => void;
  stopCallSignaling: () => void;
  initiateCall: (remoteUser: Profile, callType: CallType, conversationId?: string) => Promise<void>;
  simulateIncomingCall: (fromUser: Profile, callType: CallType) => void;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  flipCamera: () => Promise<void>;
  loadCallHistory: () => Promise<void>;

  // Group Calling
  initiateGroupCall: (groupId: string, groupTitle: string, callType: CallType, members?: Profile[]) => Promise<void>;
  leaveGroupCall: () => void;
  toggleGroupMute: () => void;
  toggleGroupVideo: () => void;
  flipGroupCamera: () => Promise<void>;
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
  callHistory: isSupabaseConfigured() ? [] : INITIAL_CALL_HISTORY,
  activeCall: null,
  activeGroupCall: null,
  timerInterval: null,
  groupTimerInterval: null,
  webrtcManager: null,
  groupWebrtcManager: null,
  signalingChannel: null,
  sessionChannel: null,
  groupCallChannel: null,

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

  initCallSignaling: () => {
    get().stopCallSignaling();
    const user = useAuthStore.getState().user;
    if (!user || !isSupabaseConfigured() || useAuthStore.getState().isDemoMode) return;

    const channel = supabase.channel(`user-calls:${user.id}`);
    channel
      .on('broadcast', { event: 'call:invite' }, (payload) => {
        const { callId, caller, callType, conversationId, sdpOffer } = payload.payload || {};
        if (!caller || !callId) return;

        const currentActive = get().activeCall;
        const currentGroup = get().activeGroupCall;
        if (currentActive || currentGroup) {
          // Send busy signal back to caller
          const busyChan = supabase.channel(`call-session:${callId}`);
          busyChan.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              busyChan.send({
                type: 'broadcast',
                event: 'call:declined',
                payload: { callId, reason: 'busy' },
              });
              setTimeout(() => supabase.removeChannel(busyChan), 1500);
            }
          });
          return;
        }

        set({
          activeCall: {
            status: 'ringing',
            callType: callType || 'audio',
            remoteUser: caller,
            isIncoming: true,
            duration: 0,
            isMuted: false,
            isVideoOff: false,
            localStream: null,
            remoteStream: null,
            callId,
            conversationId,
            sdpOffer,
          },
        });
      })
      .on('broadcast', { event: 'call:ended' }, (payload) => {
        const { callId } = payload.payload || {};
        if (get().activeCall?.callId === callId) {
          get().endCall();
        }
      })
      .subscribe();

    set({ signalingChannel: channel });
  },

  stopCallSignaling: () => {
    const { signalingChannel } = get();
    if (signalingChannel) {
      supabase.removeChannel(signalingChannel);
      set({ signalingChannel: null });
    }
  },

  initiateCall: async (remoteUser: Profile, callType: CallType, conversationId?: string) => {
    // Teardown any existing active call
    get().endCall();

    const currentUser = useAuthStore.getState().user;
    const currentProfile = useAuthStore.getState().profile;
    const isDemo = useAuthStore.getState().isDemoMode || !isSupabaseConfigured() || !remoteUser.id || remoteUser.id.startsWith('demo-');

    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let sessionChan: any = null;

    const manager = new WebRTCManager({
      onLocalStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, localStream: stream } } : state));
      },
      onRemoteStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, remoteStream: stream } } : state));
      },
      onIceCandidate: (candidate) => {
        if (!isDemo && sessionChan) {
          sessionChan.send({
            type: 'broadcast',
            event: 'call:ice-candidate',
            payload: { candidate },
          });
        }
      },
      onConnectionStateChange: (pcState) => {
        if (pcState === 'connected') {
          set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, status: 'connected' } } : state));
        } else if (pcState === 'disconnected' || pcState === 'failed') {
          get().endCall();
        }
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
        callId,
        conversationId: conversationId || null,
      },
    });

    try {
      await manager.startLocalMedia(callType === 'video');
      manager.initializePeerConnection();

      if (!isDemo && isSupabaseConfigured() && currentUser) {
        // Generate WebRTC SDP offer
        const offer = await manager.createOffer();

        // Subscribe to temporary session channel
        sessionChan = supabase.channel(`call-session:${callId}`);
        sessionChan
          .on('broadcast', { event: 'call:accepted' }, async (payload: any) => {
            const { sdpAnswer } = payload.payload || {};
            if (sdpAnswer) {
              await manager.setRemoteDescription(sdpAnswer);
              set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, status: 'connected' } } : state));

              if (!get().timerInterval) {
                const timer = setInterval(() => {
                  set((state) => {
                    if (!state.activeCall || state.activeCall.status !== 'connected') return state;
                    return { activeCall: { ...state.activeCall, duration: state.activeCall.duration + 1 } };
                  });
                }, 1000);
                set({ timerInterval: timer });
              }
            }
          })
          .on('broadcast', { event: 'call:declined' }, (payload: any) => {
            const reason = payload.payload?.reason === 'busy' ? 'User is currently busy' : 'Call declined';
            toast.error(reason);
            get().endCall();
          })
          .on('broadcast', { event: 'call:ice-candidate' }, async (payload: any) => {
            const { candidate } = payload.payload || {};
            if (candidate) {
              await manager.addIceCandidate(candidate);
            }
          })
          .on('broadcast', { event: 'call:ended' }, () => {
            toast.info('Call ended');
            get().endCall();
          })
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              // Send invitation to remote user's personal channel
              const inviteChan = supabase.channel(`user-calls:${remoteUser.id}`);
              inviteChan.subscribe((invStatus) => {
                if (invStatus === 'SUBSCRIBED') {
                  inviteChan.send({
                    type: 'broadcast',
                    event: 'call:invite',
                    payload: {
                      callId,
                      caller: currentProfile || {
                        id: currentUser.id,
                        display_name: 'MeChat User',
                        username: 'user',
                        avatar_url: '',
                      },
                      callType,
                      conversationId,
                      sdpOffer: offer,
                    },
                  });
                  setTimeout(() => supabase.removeChannel(inviteChan), 4000);
                }
              });
            }
          });

        set({ sessionChannel: sessionChan });
      } else {
        // Simulated responsive pickup for Demo Mode / demo users
        setTimeout(() => {
          if (get().activeCall?.status === 'calling') {
            if (callType === 'video' && !manager.hasRemoteTracks()) {
              manager.simulateRemoteStream(remoteUser);
            }

            set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, status: 'connected' } } : state));

            const timer = setInterval(() => {
              set((state) => {
                if (!state.activeCall || state.activeCall.status !== 'connected') return state;
                return { activeCall: { ...state.activeCall, duration: state.activeCall.duration + 1 } };
              });
            }, 1000);

            set({ timerInterval: timer });
          }
        }, 2500);
      }
    } catch (err: any) {
      if (!isDemo && typeof window !== 'undefined') {
        toast.error('Unable to access camera or microphone');
        get().endCall();
      }
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
    const isDemo = useAuthStore.getState().isDemoMode || !isSupabaseConfigured() || !activeCall.callId;

    let sessionChan: any = null;

    const manager = new WebRTCManager({
      onLocalStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, localStream: stream } } : state));
      },
      onRemoteStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, remoteStream: stream } } : state));
      },
      onIceCandidate: (candidate) => {
        if (!isDemo && sessionChan) {
          sessionChan.send({
            type: 'broadcast',
            event: 'call:ice-candidate',
            payload: { candidate },
          });
        }
      },
      onConnectionStateChange: (pcState) => {
        if (pcState === 'connected') {
          set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, status: 'connected' } } : state));
        } else if (pcState === 'disconnected' || pcState === 'failed') {
          get().endCall();
        }
      },
    });

    set({ webrtcManager: manager });

    try {
      await manager.startLocalMedia(activeCall.callType === 'video');
      manager.initializePeerConnection();

      if (!isDemo && activeCall.callId) {
        sessionChan = supabase.channel(`call-session:${activeCall.callId}`);
        sessionChan
          .on('broadcast', { event: 'call:ice-candidate' }, async (payload: any) => {
            const { candidate } = payload.payload || {};
            if (candidate) {
              await manager.addIceCandidate(candidate);
            }
          })
          .on('broadcast', { event: 'call:ended' }, () => {
            toast.info('Call ended');
            get().endCall();
          })
          .subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
              if (activeCall.sdpOffer) {
                await manager.setRemoteDescription(activeCall.sdpOffer);
                const answer = await manager.createAnswer();
                sessionChan.send({
                  type: 'broadcast',
                  event: 'call:accepted',
                  payload: { sdpAnswer: answer },
                });
              }
            }
          });

        set({ sessionChannel: sessionChan });
      } else {
        if (activeCall.callType === 'video' && !manager.hasRemoteTracks()) {
          manager.simulateRemoteStream(activeCall.remoteUser);
        }
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
    const { activeCall, sessionChannel } = get();
    if (sessionChannel && activeCall?.callId) {
      sessionChannel.send({
        type: 'broadcast',
        event: 'call:declined',
        payload: { callId: activeCall.callId, reason: 'declined' },
      });
      supabase.removeChannel(sessionChannel);
      set({ sessionChannel: null });
    }

    if (activeCall && activeCall.remoteUser) {
      const newLog: CallLog = {
        id: `call-${Date.now()}`,
        conversation_id: (activeCall.conversationId as string) || null,
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
    const { activeCall, timerInterval, webrtcManager, sessionChannel } = get();

    if (sessionChannel && activeCall?.callId) {
      sessionChannel.send({
        type: 'broadcast',
        event: 'call:ended',
        payload: { callId: activeCall.callId },
      });
      supabase.removeChannel(sessionChannel);
      set({ sessionChannel: null });
    }

    if (timerInterval) {
      clearInterval(timerInterval);
    }

    if (webrtcManager) {
      webrtcManager.stopMedia();
    }

    if (activeCall && activeCall.remoteUser && activeCall.status === 'connected') {
      const currentUserId = useAuthStore.getState().user?.id || 'demo-user-1';
      const callerId = activeCall.isIncoming ? activeCall.remoteUser.id : currentUserId;
      const receiverId = activeCall.isIncoming ? currentUserId : activeCall.remoteUser.id;

      const newLog: CallLog = {
        id: `call-${Date.now()}`,
        conversation_id: (activeCall.conversationId as string) || null,
        caller_id: callerId,
        receiver_id: receiverId,
        call_type: activeCall.callType,
        status: 'completed',
        duration_seconds: activeCall.duration,
        started_at: new Date(Date.now() - activeCall.duration * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        caller: activeCall.isIncoming ? activeCall.remoteUser : useAuthStore.getState().profile || undefined,
        receiver: activeCall.isIncoming ? useAuthStore.getState().profile || undefined : activeCall.remoteUser,
      };

      set((state) => ({ callHistory: [newLog, ...state.callHistory] }));

      // Persist to database if live authenticated session
      if (isSupabaseConfigured() && !useAuthStore.getState().isDemoMode) {
        supabase
          .from('call_logs')
          .insert({
            conversation_id: activeCall.conversationId || null,
            caller_id: callerId,
            receiver_id: receiverId,
            call_type: activeCall.callType,
            status: 'completed',
            duration_seconds: activeCall.duration,
            started_at: newLog.started_at,
            ended_at: newLog.ended_at,
          })
          .then();
      }
    }

    set({ activeCall: null, timerInterval: null, webrtcManager: null, sessionChannel: null });
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

  flipCamera: async () => {
    const { webrtcManager, activeCall } = get();
    if (webrtcManager && activeCall && activeCall.callType === 'video') {
      const newStream = await webrtcManager.switchCamera();
      if (newStream) {
        set({ activeCall: { ...activeCall, localStream: newStream } });
      }
    }
  },

  // ==========================================
  // GROUP CALLING IMPLEMENTATION
  // ==========================================

  initiateGroupCall: async (
    groupId: string,
    groupTitle: string,
    callType: CallType,
    members?: Profile[]
  ) => {
    // Teardown any existing 1-on-1 call or prior group call
    get().endCall();
    get().leaveGroupCall();

    const currentUser = useAuthStore.getState().user;
    const currentProfile = useAuthStore.getState().profile;
    const isDemo = useAuthStore.getState().isDemoMode || !isSupabaseConfigured();

    const manager = new WebRTCManager({
      onLocalStream: (stream) => {
        set((state) => {
          if (!state.activeGroupCall) return state;
          const updatedParticipants = state.activeGroupCall.participants.map((p) =>
            p.id === currentUser?.id ? { ...p, stream } : p
          );
          return {
            activeGroupCall: {
              ...state.activeGroupCall,
              localStream: stream,
              participants: updatedParticipants,
            },
          };
        });
      },
    });

    const localParticipant: GroupParticipant = {
      id: currentUser?.id || 'demo-user-1',
      user: currentProfile || {
        id: currentUser?.id || 'demo-user-1',
        display_name: 'You',
        username: 'you',
        avatar_url: '',
        bio: '',
        online_status: 'online',
        last_seen: '',
        privacy_online: true,
        privacy_last_seen: true,
        privacy_read_receipts: true,
        created_at: '',
        updated_at: '',
      },
      stream: null,
      isMuted: false,
      isVideoOff: callType === 'audio',
    };

    set({
      groupWebrtcManager: manager,
      activeGroupCall: {
        groupId,
        groupTitle,
        callType,
        status: 'connected',
        duration: 0,
        isMuted: false,
        isVideoOff: callType === 'audio',
        localStream: null,
        participants: [localParticipant],
      },
    });

    try {
      const stream = await manager.startLocalMedia(callType === 'video');

      set((state) => {
        if (!state.activeGroupCall) return state;
        return {
          activeGroupCall: {
            ...state.activeGroupCall,
            localStream: stream,
            participants: state.activeGroupCall.participants.map((p) =>
              p.id === localParticipant.id ? { ...p, stream } : p
            ),
          },
        };
      });

      // Start duration timer
      const timer = setInterval(() => {
        set((state) => {
          if (!state.activeGroupCall || state.activeGroupCall.status !== 'connected') return state;
          return {
            activeGroupCall: {
              ...state.activeGroupCall,
              duration: state.activeGroupCall.duration + 1,
            },
          };
        });
      }, 1000);

      set({ groupTimerInterval: timer });

      // If Supabase Realtime is configured, track presence in group call channel
      if (!isDemo && currentUser) {
        const groupChannel = supabase.channel(`group-call:${groupId}`, {
          config: { presence: { key: currentUser.id } },
        });

        groupChannel
          .on('presence', { event: 'sync' }, () => {
            const presenceState = groupChannel.presenceState();
            const remoteParticipants: GroupParticipant[] = [];

            Object.keys(presenceState).forEach((key) => {
              if (key !== currentUser.id) {
                const presenceData = (presenceState[key]?.[0] as any) || {};
                if (presenceData.user) {
                  remoteParticipants.push({
                    id: key,
                    user: presenceData.user,
                    isMuted: presenceData.isMuted || false,
                    isVideoOff: presenceData.isVideoOff || false,
                    isSpeaking: false,
                  });
                }
              }
            });

            set((state) => {
              if (!state.activeGroupCall) return state;
              const selfParticipant = state.activeGroupCall.participants.find(
                (p) => p.id === currentUser.id
              ) || localParticipant;
              return {
                activeGroupCall: {
                  ...state.activeGroupCall,
                  participants: [selfParticipant, ...remoteParticipants],
                },
              };
            });
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await groupChannel.track({
                user: currentProfile || { id: currentUser.id, display_name: 'MeChat User', username: 'user' },
                callType,
                isMuted: false,
                isVideoOff: callType === 'audio',
              });
            }
          });

        set({ groupCallChannel: groupChannel });
      } else {
        // Demo Mode / simulated peers joining the group call
        const candidateMembers = (members || []).filter((m) => m.id !== currentUser?.id).slice(0, 3);

        const demoPeers =
          candidateMembers.length > 0
            ? candidateMembers
            : [
                {
                  id: 'demo-user-2',
                  display_name: 'Nina Flora',
                  username: 'ninaflora',
                  avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
                  bio: '',
                  online_status: 'online' as const,
                  last_seen: '',
                  privacy_online: true,
                  privacy_last_seen: true,
                  privacy_read_receipts: true,
                  created_at: '',
                  updated_at: '',
                },
                {
                  id: 'demo-user-danang',
                  display_name: 'Danang Calvin',
                  username: 'danangcalvin',
                  avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
                  bio: '',
                  online_status: 'online' as const,
                  last_seen: '',
                  privacy_online: true,
                  privacy_last_seen: true,
                  privacy_read_receipts: true,
                  created_at: '',
                  updated_at: '',
                },
              ];

        // Staggered joining for natural feel
        demoPeers.forEach((peer, idx) => {
          setTimeout(() => {
            if (get().activeGroupCall?.status === 'connected') {
              const peerStream =
                callType === 'video'
                  ? new WebRTCManager({}).simulateRemoteStream(peer)
                  : null;

              set((state) => {
                if (!state.activeGroupCall) return state;
                if (state.activeGroupCall.participants.some((p) => p.id === peer.id)) {
                  return state;
                }
                const newParticipant: GroupParticipant = {
                  id: peer.id,
                  user: peer,
                  stream: peerStream,
                  isMuted: false,
                  isVideoOff: callType === 'audio',
                  isSpeaking: idx === 0,
                };
                return {
                  activeGroupCall: {
                    ...state.activeGroupCall,
                    participants: [...state.activeGroupCall.participants, newParticipant],
                  },
                };
              });
            }
          }, (idx + 1) * 1200);
        });
      }
    } catch (err) {
      if (!isDemo && typeof window !== 'undefined') {
        toast.error('Unable to access microphone or camera for group call');
        get().leaveGroupCall();
      }
    }
  },

  leaveGroupCall: () => {
    const { activeGroupCall, groupTimerInterval, groupWebrtcManager, groupCallChannel } = get();

    if (groupCallChannel) {
      supabase.removeChannel(groupCallChannel);
      set({ groupCallChannel: null });
    }

    if (groupTimerInterval) {
      clearInterval(groupTimerInterval);
    }

    if (groupWebrtcManager) {
      groupWebrtcManager.stopMedia();
    }

    if (activeGroupCall && activeGroupCall.duration > 0) {
      const currentUserId = useAuthStore.getState().user?.id || 'demo-user-1';
      const newLog: CallLog = {
        id: `call-${Date.now()}`,
        conversation_id: activeGroupCall.groupId,
        caller_id: currentUserId,
        receiver_id: null,
        call_type: activeGroupCall.callType,
        status: 'completed',
        duration_seconds: activeGroupCall.duration,
        started_at: new Date(Date.now() - activeGroupCall.duration * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        caller: useAuthStore.getState().profile || undefined,
      };
      set((state) => ({ callHistory: [newLog, ...state.callHistory] }));
    }

    set({
      activeGroupCall: null,
      groupTimerInterval: null,
      groupWebrtcManager: null,
    });
  },

  toggleGroupMute: () => {
    const { groupWebrtcManager, activeGroupCall, groupCallChannel } = get();
    if (groupWebrtcManager && activeGroupCall) {
      const isMuted = groupWebrtcManager.toggleMute();
      const currentUser = useAuthStore.getState().user;

      set({
        activeGroupCall: {
          ...activeGroupCall,
          isMuted,
          participants: activeGroupCall.participants.map((p) =>
            p.id === currentUser?.id ? { ...p, isMuted } : p
          ),
        },
      });

      if (groupCallChannel && currentUser) {
        groupCallChannel.track({
          user: useAuthStore.getState().profile,
          callType: activeGroupCall.callType,
          isMuted,
          isVideoOff: activeGroupCall.isVideoOff,
        });
      }
    }
  },

  toggleGroupVideo: () => {
    const { groupWebrtcManager, activeGroupCall, groupCallChannel } = get();
    if (groupWebrtcManager && activeGroupCall) {
      const isVideoOff = groupWebrtcManager.toggleVideo();
      const currentUser = useAuthStore.getState().user;

      set({
        activeGroupCall: {
          ...activeGroupCall,
          isVideoOff,
          participants: activeGroupCall.participants.map((p) =>
            p.id === currentUser?.id ? { ...p, isVideoOff } : p
          ),
        },
      });

      if (groupCallChannel && currentUser) {
        groupCallChannel.track({
          user: useAuthStore.getState().profile,
          callType: activeGroupCall.callType,
          isMuted: activeGroupCall.isMuted,
          isVideoOff,
        });
      }
    }
  },

  flipGroupCamera: async () => {
    const { groupWebrtcManager, activeGroupCall } = get();
    if (groupWebrtcManager && activeGroupCall && activeGroupCall.callType === 'video') {
      const newStream = await groupWebrtcManager.switchCamera();
      const currentUser = useAuthStore.getState().user;
      if (newStream) {
        set({
          activeGroupCall: {
            ...activeGroupCall,
            localStream: newStream,
            participants: activeGroupCall.participants.map((p) =>
              p.id === currentUser?.id ? { ...p, stream: newStream } : p
            ),
          },
        });
      }
    }
  },
}));
