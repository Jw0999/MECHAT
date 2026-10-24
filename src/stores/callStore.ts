import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CallLog, CallType, CallStatus, Profile } from '@/types/database.types';
import { WebRTCManager } from '@/features/calling/WebRTCManager';
import { useAuthStore } from './authStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { soundEffects } from '@/lib/audio/soundEffects';
import { showPushNotification } from '@/lib/notifications';
import { useChatStore } from './chatStore';

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
  incomingGroupCall: {
    groupId: string;
    groupTitle: string;
    callType: CallType;
    caller: Profile;
    members?: Profile[];
  } | null;
  timerInterval: any | null;
  groupTimerInterval: any | null;
  webrtcManager: WebRTCManager | null;
  groupWebrtcManager: WebRTCManager | null;
  signalingChannel: any | null;
  sessionChannel: any | null;
  groupCallChannel: any | null;
  inviteChannel: any | null;
  inviteHeartbeatInterval: any | null;
  groupInviteHeartbeatInterval: any | null;

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
  deleteCallLog: (id: string) => void;
  clearCallHistory: () => void;

  // Group Calling
  initiateGroupCall: (groupId: string, groupTitle: string, callType: CallType, members?: Profile[]) => Promise<void>;
  leaveGroupCall: () => void;
  dismissIncomingGroupCall: () => void;
  toggleGroupMute: () => void;
  toggleGroupVideo: () => void;
  flipGroupCamera: () => Promise<void>;
}

// Pending ICE candidates queue and group WebRTC peer mesh
const pendingIceCandidates: RTCIceCandidateInit[] = [];
const groupPeerConnections = new Map<string, WebRTCManager>();

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
  {
    id: 'call-4',
    conversation_id: 'group-1',
    caller_id: 'demo-user-1',
    receiver_id: null,
    call_type: 'video',
    status: 'completed',
    duration_seconds: 914, // 15m 14s
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    ended_at: new Date(Date.now() - 1000 * 60 * 60 * 5 + 914000).toISOString(),
    is_group: true,
    group_title: 'Product Design Team',
    group_members_count: 4,
    caller: {
      id: 'demo-user-1',
      username: 'kelvin',
      display_name: 'Kelvin',
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
  },
  {
    id: 'call-5',
    conversation_id: 'group-2',
    caller_id: 'demo-user-2',
    receiver_id: null,
    call_type: 'audio',
    status: 'completed',
    duration_seconds: 340, // 5m 40s
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    ended_at: new Date(Date.now() - 1000 * 60 * 60 * 26 + 340000).toISOString(),
    is_group: true,
    group_title: 'Weekend Hangout',
    group_members_count: 5,
    caller: {
      id: 'demo-user-2',
      username: 'ninaflora',
      display_name: 'Nina Flora',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
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

export const useCallStore = create<CallState>()(
  persist(
    (set, get) => ({
      callHistory: INITIAL_CALL_HISTORY,
      activeCall: null,
      activeGroupCall: null,
      incomingGroupCall: null,
      timerInterval: null,
      groupTimerInterval: null,
      webrtcManager: null,
      groupWebrtcManager: null,
      signalingChannel: null,
      sessionChannel: null,
      groupCallChannel: null,
      inviteChannel: null,
      inviteHeartbeatInterval: null,
      groupInviteHeartbeatInterval: null,

      deleteCallLog: (id: string) => {
        set((state) => ({
          callHistory: state.callHistory.filter((c) => c.id !== id),
        }));
      },

      clearCallHistory: () => {
        set({ callHistory: [] });
      },

      dismissIncomingGroupCall: () => {
        const { incomingGroupCall } = get();
        if (incomingGroupCall) {
          const currentUserId = useAuthStore.getState().user?.id || 'demo-user-1';
          const newLog: CallLog = {
            id: `call-group-${Date.now()}`,
            conversation_id: incomingGroupCall.groupId,
            caller_id: incomingGroupCall.caller.id,
            receiver_id: currentUserId,
            call_type: incomingGroupCall.callType,
            status: 'missed',
            duration_seconds: 0,
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
            caller: incomingGroupCall.caller,
            is_group: true,
            group_title: incomingGroupCall.groupTitle || 'Group Call',
            group_members_count: incomingGroupCall.members?.length || 2,
          };
          set((state) => ({
            callHistory: [newLog, ...state.callHistory],
            incomingGroupCall: null,
          }));
        } else {
          set({ incomingGroupCall: null });
        }
      },

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
          if (data && data.length > 0) {
            // Merge remote and local logs, deduping by id
            const localLogs = get().callHistory;
            const remoteIds = new Set(data.map((d: any) => d.id));
            const merged = [
              ...data,
              ...localLogs.filter((l) => !remoteIds.has(l.id)),
            ].sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
            set({ callHistory: merged });
          }
        } catch (e) {
          console.warn('Could not load call logs:', e);
        }
      },

  initCallSignaling: () => {
    const user = useAuthStore.getState().user;
    if (!user || !isSupabaseConfigured() || useAuthStore.getState().isDemoMode) return;

    // If channel is already subscribed and active, avoid tearing down
    const currentChannel = get().signalingChannel;
    if (currentChannel && currentChannel.state === 'joined') {
      return;
    }

    get().stopCallSignaling();

    const channel = supabase.channel(`user-calls:${user.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'call:invite' }, (payload) => {
        const { callId, caller, callType, conversationId, sdpOffer } = payload.payload || {};
        if (!caller || !callId) return;

        const currentActive = get().activeCall;
        const currentGroup = get().activeGroupCall;
        if (currentActive || currentGroup) {
          // If we are already ringing with this exact callId, ignore duplicate heartbeat
          if (currentActive?.callId === callId) return;

          // Send busy signal back to caller
          const busyChan = supabase.channel(`call-session:${callId}`);
          busyChan.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              busyChan.send({
                type: 'broadcast',
                event: 'call:declined',
                payload: { callId, reason: 'busy' },
              });
              setTimeout(() => supabase.removeChannel(busyChan), 2000);
            }
          });
          return;
        }

        // Trigger ringtone and push notification immediately
        soundEffects.playRingtone();
        showPushNotification(`${caller.display_name || 'MeChat User'} is calling...`, {
          body: `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
          tag: callId,
        });

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
      .on('broadcast', { event: 'call:accepted' }, async (payload) => {
        const { callId, sdpAnswer } = payload.payload || {};
        const currentActive = get().activeCall;
        if (!currentActive || (callId && currentActive.callId !== callId)) return;

        // Stop ringtone and pulse invites immediately
        soundEffects.stopRingtone();
        const { inviteHeartbeatInterval, inviteChannel } = get();
        if (inviteHeartbeatInterval) {
          clearInterval(inviteHeartbeatInterval);
          set({ inviteHeartbeatInterval: null });
        }
        if (inviteChannel) {
          supabase.removeChannel(inviteChannel);
          set({ inviteChannel: null });
        }

        // Instant caller transition to connected (0ms delay)
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, status: 'connected' } } : state));

        if (sdpAnswer && get().webrtcManager) {
          try {
            await get().webrtcManager?.setRemoteDescription(sdpAnswer);
          } catch (e) {
            console.warn('Set remote description error:', e);
          }
        }

        if (!get().timerInterval) {
          const timer = setInterval(() => {
            set((state) => {
              if (!state.activeCall || state.activeCall.status !== 'connected') return state;
              return { activeCall: { ...state.activeCall, duration: state.activeCall.duration + 1 } };
            });
          }, 1000);
          set({ timerInterval: timer });
        }
      })
      .on('broadcast', { event: 'call:declined' }, (payload) => {
        const { callId, reason } = payload.payload || {};
        const currentActive = get().activeCall;
        if (currentActive && (!callId || currentActive.callId === callId)) {
          soundEffects.stopRingtone();
          toast.error(reason === 'busy' ? 'User is busy on another call' : 'Call declined');
          get().endCall();
        }
      })
      .on('broadcast', { event: 'call:ice-candidate' }, async (payload) => {
        const { callId, candidate } = payload.payload || {};
        const currentActive = get().activeCall;
        if (currentActive && (!callId || currentActive.callId === callId) && candidate) {
          if (get().webrtcManager) {
            try {
              await get().webrtcManager?.addIceCandidate(candidate);
            } catch (e) {
              console.warn('Add ICE candidate error:', e);
            }
          } else {
            pendingIceCandidates.push(candidate);
          }
        }
      })
      .on('broadcast', { event: 'call:ended' }, (payload) => {
        const { callId } = payload.payload || {};
        if (get().activeCall?.callId === callId) {
          soundEffects.stopRingtone();
          get().endCall();
        }
      })
      .on('broadcast', { event: 'call:group-invite' }, (payload) => {
        const { groupId, groupTitle, callType, caller, members } = payload.payload || {};
        if (!groupId || !caller || caller.id === user.id) return;
        if (get().activeCall || get().activeGroupCall) return;

        // Ignore duplicate heartbeat if already alerting for same group call
        if (get().incomingGroupCall?.groupId === groupId) return;

        soundEffects.playMessageSound();
        showPushNotification(`${caller.display_name || 'Someone'} started a group call`, {
          body: `Group ${callType === 'video' ? 'Video' : 'Voice'} Call • ${groupTitle || 'Group'}`,
          tag: `group-call-${groupId}`,
        });

        set({
          incomingGroupCall: {
            groupId,
            groupTitle: groupTitle || 'Group Call',
            callType: callType || 'video',
            caller,
            members,
          },
        });

        toast.info(`${caller.display_name || 'Someone'} started a Group ${callType === 'video' ? 'Video' : 'Voice'} Call`, {
          duration: 12000,
          action: {
            label: 'Join Now',
            onClick: () => {
              get().initiateGroupCall(groupId, groupTitle || 'Group Call', callType || 'video', members);
              set({ incomingGroupCall: null });
            },
          },
        });
      })
      .on('broadcast', { event: 'call:group-ended' }, (payload) => {
        const { groupId } = payload.payload || {};
        if (get().incomingGroupCall?.groupId === groupId) {
          get().dismissIncomingGroupCall();
        }
      })
      .subscribe();

    set({ signalingChannel: channel });
  },

  stopCallSignaling: () => {
    const { signalingChannel, inviteChannel, inviteHeartbeatInterval, groupInviteHeartbeatInterval } = get();
    if (inviteHeartbeatInterval) {
      clearInterval(inviteHeartbeatInterval);
      set({ inviteHeartbeatInterval: null });
    }
    if (groupInviteHeartbeatInterval) {
      clearInterval(groupInviteHeartbeatInterval);
      set({ groupInviteHeartbeatInterval: null });
    }
    if (inviteChannel) {
      supabase.removeChannel(inviteChannel);
      set({ inviteChannel: null });
    }
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
    const pendingLocalCandidates: any[] = [];
    let isSessionSubscribed = false;

    const manager = new WebRTCManager({
      onLocalStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, localStream: stream } } : state));
      },
      onRemoteStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, remoteStream: stream } } : state));
      },
      onIceCandidate: (candidate) => {
        if (!isDemo) {
          if (isSessionSubscribed && sessionChan) {
            sessionChan.send({
              type: 'broadcast',
              event: 'call:ice-candidate',
              payload: { callId, candidate },
            });
          } else {
            pendingLocalCandidates.push(candidate);
          }
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

    // 0ms instant UI feedback: show outgoing calling screen immediately
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
      const mediaPromise = manager.startLocalMedia(callType === 'video');

      if (!isDemo && isSupabaseConfigured() && currentUser) {
        await mediaPromise;
        manager.initializePeerConnection();

        // Generate WebRTC SDP offer
        const offer = await manager.createOffer();

        // 1. Subscribe to temporary session channel
        sessionChan = supabase.channel(`call-session:${callId}`);
        sessionChan
          .on('broadcast', { event: 'call:accepted' }, async (payload: any) => {
            const { sdpAnswer } = payload.payload || {};
            // Stop dialing invite pulse immediately once call is answered
            const { inviteHeartbeatInterval, inviteChannel } = get();
            if (inviteHeartbeatInterval) {
              clearInterval(inviteHeartbeatInterval);
              set({ inviteHeartbeatInterval: null });
            }
            if (inviteChannel) {
              supabase.removeChannel(inviteChannel);
              set({ inviteChannel: null });
            }

            set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, status: 'connected' } } : state));

            if (sdpAnswer) {
              try {
                await manager.setRemoteDescription(sdpAnswer);
              } catch (e) {
                console.warn('Set remote description error:', e);
              }
            }

            if (!get().timerInterval) {
              const timer = setInterval(() => {
                set((state) => {
                  if (!state.activeCall || state.activeCall.status !== 'connected') return state;
                  return { activeCall: { ...state.activeCall, duration: state.activeCall.duration + 1 } };
                });
              }, 1000);
              set({ timerInterval: timer });
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
              isSessionSubscribed = true;
              while (pendingLocalCandidates.length > 0) {
                const cand = pendingLocalCandidates.shift();
                sessionChan.send({
                  type: 'broadcast',
                  event: 'call:ice-candidate',
                  payload: { callId, candidate: cand },
                });
              }
            }
          });

        set({ sessionChannel: sessionChan });

        // 2. Dispatch invitation to remote user's personal channel with pulse heartbeat
        const invitePayload = {
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
        };

        const inviteChan = supabase.channel(`user-calls:${remoteUser.id}`);
        set({ inviteChannel: inviteChan });

        inviteChan.subscribe((invStatus) => {
          if (invStatus === 'SUBSCRIBED') {
            // Send initial invite immediately
            inviteChan.send({
              type: 'broadcast',
              event: 'call:invite',
              payload: invitePayload,
            });

            // Heartbeat pulse every 2.5s while ringing to ensure the recipient receives the invite
            const pulse = setInterval(() => {
              if (get().activeCall?.status === 'calling') {
                inviteChan.send({
                  type: 'broadcast',
                  event: 'call:invite',
                  payload: invitePayload,
                });
              } else {
                clearInterval(pulse);
                set({ inviteHeartbeatInterval: null });
              }
            }, 2500);

            set({ inviteHeartbeatInterval: pulse });
          }
        });

        // 3. Concurrently dispatch on active conversation channel if provided
        if (conversationId) {
          const convChan = supabase.channel(`conversation:${conversationId}`);
          convChan.subscribe((convStatus) => {
            if (convStatus === 'SUBSCRIBED') {
              convChan.send({
                type: 'broadcast',
                event: 'call:invite',
                payload: invitePayload,
              });
              setTimeout(() => supabase.removeChannel(convChan), 5000);
            }
          });
        }
      } else {
        // Simulated responsive pickup for Demo Mode / demo users
        await mediaPromise;
        manager.initializePeerConnection();

        setTimeout(() => {
          if (get().activeCall?.status === 'calling') {
            if (callType === 'video' && !manager.hasRemoteTracks()) {
              manager.simulateRemoteStream(remoteUser);
            } else if (callType === 'audio' && !manager.hasRemoteTracks()) {
              manager.simulateAudioStream();
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
        }, 450); // Snappy, instant feel instead of slow delay
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
    const callId = `call-sim-${Date.now()}`;
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
        callId,
      },
    });
  },

  acceptCall: async () => {
    const { activeCall } = get();
    if (!activeCall || !activeCall.remoteUser) return;
    const isDemo = useAuthStore.getState().isDemoMode || !isSupabaseConfigured() || !activeCall.callId;

    // Stop incoming ringtone immediately upon accept
    soundEffects.stopRingtone();

    // 1. INSTANTLY transition UI to connected state (0ms delay)
    // Stops incoming ringtone chime immediately and reveals call controls
    set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, status: 'connected' } } : state));

    // 2. Start duration timer immediately
    if (!get().timerInterval) {
      const timer = setInterval(() => {
        set((state) => {
          if (!state.activeCall || state.activeCall.status !== 'connected') return state;
          return { activeCall: { ...state.activeCall, duration: state.activeCall.duration + 1 } };
        });
      }, 1000);
      set({ timerInterval: timer });
    }

    let sessionChan: any = null;
    const pendingLocalCandidates: any[] = [];
    let isSessionSubscribed = false;

    const manager = new WebRTCManager({
      onLocalStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, localStream: stream } } : state));
      },
      onRemoteStream: (stream) => {
        set((state) => (state.activeCall ? { activeCall: { ...state.activeCall, remoteStream: stream } } : state));
      },
      onIceCandidate: (candidate) => {
        if (!isDemo) {
          if (isSessionSubscribed && sessionChan) {
            sessionChan.send({
              type: 'broadcast',
              event: 'call:ice-candidate',
              payload: { callId: activeCall.callId, candidate },
            });
          } else {
            pendingLocalCandidates.push(candidate);
          }
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

    // 3. Subscribe to session channel if live Supabase mode
    if (!isDemo && activeCall.callId && activeCall.remoteUser?.id) {
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
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            isSessionSubscribed = true;
            while (pendingLocalCandidates.length > 0) {
              const cand = pendingLocalCandidates.shift();
              sessionChan.send({
                type: 'broadcast',
                event: 'call:ice-candidate',
                payload: { callId: activeCall.callId, candidate: cand },
              });
            }
          }
        });

      set({ sessionChannel: sessionChan });
    }

    // 4. Start local media and complete WebRTC negotiation in parallel
    try {
      await manager.startLocalMedia(activeCall.callType === 'video');
      manager.initializePeerConnection();

      // Drain any queued ICE candidates received while phone was ringing
      while (pendingIceCandidates.length > 0) {
        const cand = pendingIceCandidates.shift();
        if (cand) {
          await manager.addIceCandidate(cand);
        }
      }

      if (isDemo) {
        if (activeCall.callType === 'video' && !manager.hasRemoteTracks()) {
          manager.simulateRemoteStream(activeCall.remoteUser);
        } else if (activeCall.callType === 'audio' && !manager.hasRemoteTracks()) {
          manager.simulateAudioStream();
        }
      } else if (activeCall.sdpOffer) {
        await manager.setRemoteDescription(activeCall.sdpOffer);
        const answer = await manager.createAnswer();
        if (sessionChan) {
          sessionChan.send({
            type: 'broadcast',
            event: 'call:accepted',
            payload: { callId: activeCall.callId, sdpAnswer: answer },
          });
        }
        if (activeCall.remoteUser?.id) {
          const directChan = supabase.channel(`user-calls:${activeCall.remoteUser.id}`);
          directChan.subscribe((st) => {
            if (st === 'SUBSCRIBED') {
              directChan.send({
                type: 'broadcast',
                event: 'call:accepted',
                payload: { callId: activeCall.callId, sdpAnswer: answer },
              });
              setTimeout(() => supabase.removeChannel(directChan), 3000);
            }
          });
        }
      } else {
        // Fallback notification if no offer provided
        if (sessionChan) {
          sessionChan.send({
            type: 'broadcast',
            event: 'call:accepted',
            payload: { callId: activeCall.callId },
          });
        }
      }
    } catch (err) {
      if (!isDemo && typeof window !== 'undefined') {
        toast.error('Failed to access media devices');
        get().endCall();
      }
    }
  },

  rejectCall: () => {
    soundEffects.stopRingtone();
    const { activeCall, sessionChannel, inviteHeartbeatInterval, inviteChannel } = get();

    if (inviteHeartbeatInterval) {
      clearInterval(inviteHeartbeatInterval);
      set({ inviteHeartbeatInterval: null });
    }
    if (inviteChannel) {
      supabase.removeChannel(inviteChannel);
      set({ inviteChannel: null });
    }

    if (sessionChannel && activeCall?.callId) {
      sessionChannel.send({
        type: 'broadcast',
        event: 'call:declined',
        payload: { callId: activeCall.callId, reason: 'declined' },
      });
      supabase.removeChannel(sessionChannel);
      set({ sessionChannel: null });
    }

    if (activeCall?.remoteUser?.id) {
      const directChan = supabase.channel(`user-calls:${activeCall.remoteUser.id}`);
      directChan.subscribe((st) => {
        if (st === 'SUBSCRIBED') {
          directChan.send({
            type: 'broadcast',
            event: 'call:declined',
            payload: { callId: activeCall.callId, reason: 'declined' },
          });
          setTimeout(() => supabase.removeChannel(directChan), 2000);
        }
      });
    }

    if (activeCall && activeCall.remoteUser) {
      const currentUserId = useAuthStore.getState().user?.id || 'demo-user-1';
      const callLogId = activeCall.callId
        ? (activeCall.callId.startsWith('call-') ? activeCall.callId : `call-${activeCall.callId}`)
        : `call-${Date.now()}`;

      const newLog: CallLog = {
        id: callLogId,
        conversation_id: (activeCall.conversationId as string) || null,
        caller_id: activeCall.remoteUser.id,
        receiver_id: currentUserId,
        call_type: activeCall.callType,
        status: 'declined',
        duration_seconds: 0,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        caller: activeCall.remoteUser,
        receiver: useAuthStore.getState().profile || undefined,
      };
      set((state) => ({ callHistory: [newLog, ...state.callHistory] }));
    }
    get().endCall();
  },

  endCall: () => {
    soundEffects.stopRingtone();
    const { activeCall, timerInterval, webrtcManager, sessionChannel, inviteHeartbeatInterval, inviteChannel, groupInviteHeartbeatInterval } = get();

    if (inviteHeartbeatInterval) {
      clearInterval(inviteHeartbeatInterval);
      set({ inviteHeartbeatInterval: null });
    }
    if (groupInviteHeartbeatInterval) {
      clearInterval(groupInviteHeartbeatInterval);
      set({ groupInviteHeartbeatInterval: null });
    }
    if (inviteChannel) {
      supabase.removeChannel(inviteChannel);
      set({ inviteChannel: null });
    }

    if (sessionChannel && activeCall?.callId) {
      sessionChannel.send({
        type: 'broadcast',
        event: 'call:ended',
        payload: { callId: activeCall.callId },
      });
      supabase.removeChannel(sessionChannel);
      set({ sessionChannel: null });
    }

    if (activeCall?.remoteUser?.id) {
      const directChan = supabase.channel(`user-calls:${activeCall.remoteUser.id}`);
      directChan.subscribe((st) => {
        if (st === 'SUBSCRIBED') {
          directChan.send({
            type: 'broadcast',
            event: 'call:ended',
            payload: { callId: activeCall.callId },
          });
          setTimeout(() => supabase.removeChannel(directChan), 2000);
        }
      });
    }

    if (timerInterval) {
      clearInterval(timerInterval);
    }

    if (webrtcManager) {
      webrtcManager.stopMedia();
    }

    if (activeCall && activeCall.remoteUser) {
      const currentUserId = useAuthStore.getState().user?.id || 'demo-user-1';
      const callerId = activeCall.isIncoming ? activeCall.remoteUser.id : currentUserId;
      const receiverId = activeCall.isIncoming ? currentUserId : activeCall.remoteUser.id;

      let callStatus: CallStatus = 'completed';
      if (activeCall.status === 'connected') {
        callStatus = 'completed';
      } else if (activeCall.isIncoming) {
        callStatus = 'missed';
      } else {
        callStatus = 'cancelled';
      }

      const duration = activeCall.duration || 0;
      const callLogId = activeCall.callId
        ? (activeCall.callId.startsWith('call-') ? activeCall.callId : `call-${activeCall.callId}`)
        : `call-${Date.now()}`;

      // Avoid duplicating if already logged (e.g. from rejectCall)
      const alreadyLogged = get().callHistory.some((c) => c.id === callLogId);

      if (!alreadyLogged) {
        const newLog: CallLog = {
          id: callLogId,
          conversation_id: (activeCall.conversationId as string) || null,
          caller_id: callerId,
          receiver_id: receiverId,
          call_type: activeCall.callType,
          status: callStatus,
          duration_seconds: duration,
          started_at: new Date(Date.now() - duration * 1000).toISOString(),
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
              status: callStatus,
              duration_seconds: duration,
              started_at: newLog.started_at,
              ended_at: newLog.ended_at,
            })
            .then();
        }
      }
    }

    pendingIceCandidates.length = 0;
    set({
      activeCall: null,
      timerInterval: null,
      webrtcManager: null,
      sessionChannel: null,
      inviteChannel: null,
      inviteHeartbeatInterval: null,
    });
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

    let effectiveMembers = members;
    if (!effectiveMembers || effectiveMembers.length === 0) {
      const conv = useChatStore.getState().conversations.find((c) => c.id === groupId);
      if (conv?.members) {
        effectiveMembers = conv.members.map((m) => m.profile).filter(Boolean) as Profile[];
      }
    }

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

      // If Supabase Realtime is configured, broadcast invites and track presence in group call channel
      if (!isDemo && currentUser) {
        const sendGroupInvites = () => {
          (effectiveMembers || []).forEach((member) => {
            if (member && member.id && member.id !== currentUser.id) {
              const memChan = supabase.channel(`user-calls:${member.id}`);
              memChan.subscribe((st) => {
                if (st === 'SUBSCRIBED') {
                  memChan.send({
                    type: 'broadcast',
                    event: 'call:group-invite',
                    payload: {
                      groupId,
                      groupTitle,
                      callType,
                      caller: currentProfile || { id: currentUser.id, display_name: 'MeChat User' },
                      members: effectiveMembers,
                    },
                  });
                  setTimeout(() => supabase.removeChannel(memChan), 2500);
                }
              });
            }
          });
        };

        // Send initial invites immediately
        sendGroupInvites();

        // Pulse group invites for the first 30 seconds
        let pulseCount = 0;
        const groupHeartbeat = setInterval(() => {
          pulseCount++;
          if (get().activeGroupCall?.status === 'connected' && pulseCount < 10) {
            sendGroupInvites();
          } else {
            clearInterval(groupHeartbeat);
            set({ groupInviteHeartbeatInterval: null });
          }
        }, 3500);
        set({ groupInviteHeartbeatInterval: groupHeartbeat });

        // Also broadcast on the group's conversation channel
        const convChan = supabase.channel(`conversation:${groupId}`);
        convChan.subscribe((st) => {
          if (st === 'SUBSCRIBED') {
            convChan.send({
              type: 'broadcast',
              event: 'call:group-invite',
              payload: {
                groupId,
                groupTitle,
                callType,
                caller: currentProfile || { id: currentUser.id, display_name: 'MeChat User' },
                members: effectiveMembers,
              },
            });
            setTimeout(() => supabase.removeChannel(convChan), 4000);
          }
        });

        const groupChannel = supabase.channel(`group-call:${groupId}`, {
          config: { presence: { key: currentUser.id } },
        });

        // Listen for WebRTC Mesh signals (offer, answer, candidate) from other group call members
        groupChannel
          .on('broadcast', { event: 'group-call:signal' }, async (payload) => {
            const { from, to, type, sdp, candidate } = payload.payload || {};
            if (to !== currentUser.id || !from) return;

            let peerMgr = groupPeerConnections.get(from);
            if (!peerMgr && type === 'offer') {
              peerMgr = new WebRTCManager({
                onRemoteStream: (remoteStream) => {
                  set((state) => {
                    if (!state.activeGroupCall) return state;
                    const participants = state.activeGroupCall.participants.map((p) =>
                      p.id === from ? { ...p, stream: remoteStream } : p
                    );
                    return { activeGroupCall: { ...state.activeGroupCall, participants } };
                  });
                },
                onIceCandidate: (cand) => {
                  groupChannel.send({
                    type: 'broadcast',
                    event: 'group-call:signal',
                    payload: { from: currentUser.id, to: from, type: 'candidate', candidate: cand },
                  });
                },
              });
              groupPeerConnections.set(from, peerMgr);
              if (stream) {
                peerMgr.setExistingLocalStream(stream);
              }
              peerMgr.initializePeerConnection();
            }

            if (peerMgr) {
              if (type === 'offer' && sdp) {
                try {
                  await peerMgr.setRemoteDescription(sdp);
                  const answer = await peerMgr.createAnswer();
                  groupChannel.send({
                    type: 'broadcast',
                    event: 'group-call:signal',
                    payload: { from: currentUser.id, to: from, type: 'answer', sdp: answer },
                  });
                } catch (e) {
                  console.warn('Group call offer processing error:', e);
                }
              } else if (type === 'answer' && sdp) {
                try {
                  await peerMgr.setRemoteDescription(sdp);
                } catch (e) {
                  console.warn('Group call answer processing error:', e);
                }
              } else if (type === 'candidate' && candidate) {
                try {
                  await peerMgr.addIceCandidate(candidate);
                } catch (e) {
                  console.warn('Group call ICE candidate error:', e);
                }
              }
            }
          })
          .on('presence', { event: 'sync' }, () => {
            const presenceState = groupChannel.presenceState();
            const remoteParticipants: GroupParticipant[] = [];

            Object.keys(presenceState).forEach((key) => {
              if (key !== currentUser.id) {
                const presenceData = (presenceState[key]?.[0] as any) || {};
                if (presenceData.user) {
                  const existingP = get().activeGroupCall?.participants.find((p) => p.id === key);
                  remoteParticipants.push({
                    id: key,
                    user: presenceData.user,
                    stream: existingP?.stream || null,
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

            // WebRTC Full-Mesh: Initiator rule (lexicographical smaller ID initiates offer)
            remoteParticipants.forEach(async (peer) => {
              if (currentUser.id < peer.id && !groupPeerConnections.has(peer.id)) {
                const peerMgr = new WebRTCManager({
                  onRemoteStream: (remoteStream) => {
                    set((state) => {
                      if (!state.activeGroupCall) return state;
                      const participants = state.activeGroupCall.participants.map((p) =>
                        p.id === peer.id ? { ...p, stream: remoteStream } : p
                      );
                      return { activeGroupCall: { ...state.activeGroupCall, participants } };
                    });
                  },
                  onIceCandidate: (cand) => {
                    groupChannel.send({
                      type: 'broadcast',
                      event: 'group-call:signal',
                      payload: { from: currentUser.id, to: peer.id, type: 'candidate', candidate: cand },
                    });
                  },
                });
                groupPeerConnections.set(peer.id, peerMgr);
                if (stream) {
                  peerMgr.setExistingLocalStream(stream);
                }
                peerMgr.initializePeerConnection();
                const offer = await peerMgr.createOffer();
                groupChannel.send({
                  type: 'broadcast',
                  event: 'group-call:signal',
                  payload: { from: currentUser.id, to: peer.id, type: 'offer', sdp: offer },
                });
              }
            });

            // Clean up any peers that left the call
            const activeIds = new Set(remoteParticipants.map((p) => p.id));
            for (const [peerId, peerMgr] of groupPeerConnections.entries()) {
              if (!activeIds.has(peerId)) {
                peerMgr.stopMedia(false);
                groupPeerConnections.delete(peerId);
              }
            }
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
        // Demo Mode / simulated peers joining the group call rapidly with zero delay
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
                {
                  id: 'demo-user-satria',
                  display_name: 'Satria herman',
                  username: 'satriah',
                  avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
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

        // Snappy zero-delay joining: Peer 1 at 200ms, Peer 2 at 450ms, Peer 3 at 700ms
        demoPeers.forEach((peer, idx) => {
          const joinDelay = 200 + idx * 250;
          setTimeout(() => {
            if (get().activeGroupCall?.status === 'connected') {
              const peerStream =
                callType === 'video'
                  ? new WebRTCManager({}).simulateRemoteStream(peer)
                  : new WebRTCManager({}).simulateAudioStream();

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
          }, joinDelay);
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
    const { activeGroupCall, groupTimerInterval, groupWebrtcManager, groupCallChannel, groupInviteHeartbeatInterval } = get();

    if (groupInviteHeartbeatInterval) {
      clearInterval(groupInviteHeartbeatInterval);
      set({ groupInviteHeartbeatInterval: null });
    }

    if (groupCallChannel && activeGroupCall) {
      groupCallChannel.send({
        type: 'broadcast',
        event: 'call:group-ended',
        payload: { groupId: activeGroupCall.groupId },
      });
      supabase.removeChannel(groupCallChannel);
      set({ groupCallChannel: null });
    }

    if (groupTimerInterval) {
      clearInterval(groupTimerInterval);
    }

    // Clean up all mesh peer connections
    for (const peerMgr of groupPeerConnections.values()) {
      peerMgr.stopMedia(false);
    }
    groupPeerConnections.clear();

    if (groupWebrtcManager) {
      groupWebrtcManager.stopMedia(true);
    }

    if (activeGroupCall) {
      const currentUserId = useAuthStore.getState().user?.id || 'demo-user-1';
      const duration = activeGroupCall.duration || 0;
      const newLog: CallLog = {
        id: `call-group-${Date.now()}`,
        conversation_id: activeGroupCall.groupId,
        caller_id: currentUserId,
        receiver_id: null,
        call_type: activeGroupCall.callType,
        status: duration > 0 ? 'completed' : 'cancelled',
        duration_seconds: duration,
        started_at: new Date(Date.now() - duration * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        caller: useAuthStore.getState().profile || undefined,
        is_group: true,
        group_title: activeGroupCall.groupTitle || 'Group Call',
        group_members_count: activeGroupCall.participants.length || 1,
      };
      set((state) => ({ callHistory: [newLog, ...state.callHistory] }));

      if (isSupabaseConfigured() && !useAuthStore.getState().isDemoMode) {
        supabase
          .from('call_logs')
          .insert({
            conversation_id: activeGroupCall.groupId,
            caller_id: currentUserId,
            receiver_id: null,
            call_type: activeGroupCall.callType,
            status: newLog.status,
            duration_seconds: duration,
            started_at: newLog.started_at,
            ended_at: newLog.ended_at,
          })
          .then();
      }
    }

    set({
      activeGroupCall: null,
      incomingGroupCall: null,
      groupTimerInterval: null,
      groupWebrtcManager: null,
      groupInviteHeartbeatInterval: null,
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
  }),
  {
    name: 'mechat-calls-storage',
    storage: createJSONStorage(() => ({
      getItem: (name: string) => (typeof window !== 'undefined' ? window.localStorage.getItem(name) : null),
      setItem: (name: string, value: string) => {
        if (typeof window !== 'undefined') window.localStorage.setItem(name, value);
      },
      removeItem: (name: string) => {
        if (typeof window !== 'undefined') window.localStorage.removeItem(name);
      },
    })),
    partialize: (state) => ({ callHistory: state.callHistory }),
  }
)
);
