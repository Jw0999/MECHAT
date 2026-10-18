import React, { useRef, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, RotateCw } from 'lucide-react';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDuration } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/audio/soundEffects';

export const CallOverlayModal: React.FC = () => {
  const activeCall = useCallStore((s) => s.activeCall);
  const acceptCall = useCallStore((s) => s.acceptCall);
  const rejectCall = useCallStore((s) => s.rejectCall);
  const endCall = useCallStore((s) => s.endCall);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleVideo = useCallStore((s) => s.toggleVideo);
  const flipCamera = useCallStore((s) => s.flipCamera);
  const currentUser = useAuthStore((s) => s.profile);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Callback ref for remote audio ensuring immediate and continuous voice playback
  const setRemoteAudio = useCallback(
    (el: HTMLAudioElement | null) => {
      remoteAudioRef.current = el;
      if (el && activeCall?.remoteStream) {
        if (el.srcObject !== activeCall.remoteStream) {
          el.srcObject = activeCall.remoteStream;
        }
        el.play().catch((e) => console.warn('Remote audio playback error:', e));
      }
    },
    [activeCall?.remoteStream]
  );

  // Callback ref for local video ensuring immediate stream binding on mount
  const setLocalVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      localVideoRef.current = el;
      if (el && activeCall?.localStream) {
        if (el.srcObject !== activeCall.localStream) {
          el.srcObject = activeCall.localStream;
        }
        el.play().catch(() => {});
      }
    },
    [activeCall?.localStream]
  );

  // Callback ref for remote video ensuring immediate stream binding on mount
  const setRemoteVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      remoteVideoRef.current = el;
      if (el && activeCall?.remoteStream) {
        if (el.srcObject !== activeCall.remoteStream) {
          el.srcObject = activeCall.remoteStream;
        }
        el.play().catch(() => {});
      }
    },
    [activeCall?.remoteStream]
  );

  // Keep streams attached if they update or call state transitions
  useEffect(() => {
    if (localVideoRef.current && activeCall?.localStream) {
      if (localVideoRef.current.srcObject !== activeCall.localStream) {
        localVideoRef.current.srcObject = activeCall.localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [activeCall?.localStream, activeCall?.status, activeCall?.isVideoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && activeCall?.remoteStream) {
      if (remoteVideoRef.current.srcObject !== activeCall.remoteStream) {
        remoteVideoRef.current.srcObject = activeCall.remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [activeCall?.remoteStream, activeCall?.status]);

  useEffect(() => {
    if (remoteAudioRef.current && activeCall?.remoteStream) {
      if (remoteAudioRef.current.srcObject !== activeCall.remoteStream) {
        remoteAudioRef.current.srcObject = activeCall.remoteStream;
      }
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [activeCall?.remoteStream, activeCall?.status]);

  // Play ringing chime when incoming (ringing) or outgoing (calling)
  useEffect(() => {
    if (activeCall?.status === 'calling' || activeCall?.status === 'ringing') {
      soundEffects.startRingtone();
    } else {
      soundEffects.stopRingtone();
    }
    return () => {
      soundEffects.stopRingtone();
    };
  }, [activeCall?.status]);

  if (!activeCall) return null;

  const isVideo = activeCall.callType === 'video';
  const remoteUser = activeCall.remoteUser;
  const isIncoming = activeCall.isIncoming && activeCall.status === 'ringing';

  const hasLocalVideo = Boolean(
    isVideo &&
      activeCall.localStream &&
      !activeCall.isVideoOff &&
      activeCall.localStream.getVideoTracks().length > 0 &&
      activeCall.localStream.getVideoTracks().some((t) => t.enabled)
  );

  const hasRemoteVideo = Boolean(
    isVideo &&
      activeCall.status === 'connected' &&
      activeCall.remoteStream &&
      activeCall.remoteStream.getVideoTracks().length > 0 &&
      activeCall.remoteStream.getVideoTracks().some((t) => t.enabled)
  );

  const isVideoCallActive = isVideo && (activeCall.status === 'connected' || activeCall.status === 'calling');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in text-[#F5F7F7] select-none">
      {/* Dedicated audio element ensuring crystal clear voice audio on all devices */}
      {activeCall.status === 'connected' && activeCall.remoteStream && (
        <audio
          ref={setRemoteAudio}
          autoPlay
          playsInline
          className="hidden"
        />
      )}

      {/* Video Call Stream View (Calling or Connected) */}
      {isVideoCallActive ? (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {/* Main View: Connected Remote Video OR Calling Avatar / Remote Ambient Placeholder */}
          {activeCall.status === 'connected' && hasRemoteVideo ? (
            <video
              ref={setRemoteVideo}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
              {/* Blurred Ambient Backdrop using remote user's avatar */}
              <div
                className="absolute inset-0 bg-cover bg-center blur-3xl opacity-20 scale-125"
                style={{
                  backgroundImage: `url(${
                    remoteUser?.avatar_url ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${remoteUser?.display_name || 'user'}`
                  })`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/85 to-[#0B0F10]" />

              <div className="relative z-10 flex flex-col items-center">
                <div className="relative mb-6">
                  {activeCall.status === 'calling' && (
                    <div className="w-32 h-32 rounded-full border-4 border-brand/30 call-pulse-ring absolute inset-0 -m-2" />
                  )}
                  <img
                    src={
                      remoteUser?.avatar_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${remoteUser?.display_name || 'user'}`
                    }
                    alt={remoteUser?.display_name || ''}
                    className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-brand shadow-2xl relative z-10"
                  />
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-white">
                  {remoteUser?.display_name}
                </h2>

                <p className="text-sm text-[#9BA5A8] font-medium mb-3">
                  {activeCall.status === 'calling'
                    ? `Calling ${remoteUser?.display_name}...`
                    : activeCall.status === 'connected'
                    ? 'Video Connected'
                    : 'Connecting...'}
                </p>

                {activeCall.status === 'connected' && (
                  <div className="bg-[#151A1C]/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 font-mono text-xs text-brand font-bold mb-4">
                    {formatDuration(activeCall.duration)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Local Camera (Picture-in-Picture) */}
          <div className="absolute top-[calc(1.5rem+env(safe-area-inset-top,0px))] right-4 sm:right-6 w-32 sm:w-44 aspect-[3/4] bg-[#151A1C] rounded-2xl overflow-hidden border-2 border-brand/50 shadow-2xl z-20 flex items-center justify-center group">
            {hasLocalVideo ? (
              <video
                ref={setLocalVideo}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-[#182022]">
                <img
                  src={
                    currentUser?.avatar_url ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.display_name || 'you'}`
                  }
                  alt="You"
                  className="w-14 h-14 rounded-full object-cover border-2 border-brand/40 mb-2 shadow"
                />
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#9BA5A8]">
                  <VideoOff size={12} className="text-red-400" />
                  <span>Camera off</span>
                </div>
              </div>
            )}

            {/* Self Badge */}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white/90 pointer-events-none flex items-center gap-1">
              <span>You</span>
              {activeCall.isMuted && <MicOff size={10} className="text-red-400" />}
            </div>
          </div>

          {/* Connected Call Header */}
          {activeCall.status === 'connected' && (
            <div className="absolute top-[calc(1.5rem+env(safe-area-inset-top,0px))] left-4 sm:left-6 z-20 flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
              <span className="text-sm font-bold">{remoteUser?.display_name}</span>
              <span className="text-xs font-mono text-[#9BA5A8]">
                {formatDuration(activeCall.duration)}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Audio Call View or Incoming Ringing View */
        <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm w-full">
          {/* Pulsing Avatar with Rings */}
          <div className="relative mb-8">
            <div className="w-32 h-32 rounded-full border-4 border-brand/30 call-pulse-ring absolute inset-0 -m-2" />
            <img
              src={
                remoteUser?.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${remoteUser?.display_name || 'user'}`
              }
              alt={remoteUser?.display_name || ''}
              className="w-32 h-32 rounded-full object-cover border-4 border-brand shadow-2xl relative z-10"
            />
          </div>

          <h2 className="text-2xl font-bold tracking-tight mb-1">{remoteUser?.display_name}</h2>

          <p className="text-sm text-[#9BA5A8] font-medium mb-3">
            {isIncoming
              ? `Incoming ${isVideo ? 'Video' : 'Audio'} Call...`
              : activeCall.status === 'calling'
              ? `Calling ${remoteUser?.display_name}...`
              : activeCall.status === 'connected'
              ? `${isVideo ? 'Video' : 'Audio'} Call Connected`
              : 'Connecting...'}
          </p>

          {activeCall.status === 'connected' && (
            <div className="bg-[#151A1C] px-4 py-1.5 rounded-full border border-[#252C2E] mb-6 font-mono text-sm text-brand font-bold">
              {formatDuration(activeCall.duration)}
            </div>
          )}

          {/* Audio Visualizer Waves when connected */}
          {activeCall.status === 'connected' && !isVideo && (
            <div className="flex items-center justify-center gap-1.5 h-8 my-4">
              {[30, 60, 90, 45, 80, 100, 70, 40, 85, 55, 95, 35].map((h, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-brand animate-pulse"
                  style={{
                    height: `${h}%`,
                    animationDelay: `${(i * 0.1).toFixed(1)}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Controls Bar at Bottom */}
      <div className="absolute bottom-[max(18px,calc(1.25rem+env(safe-area-inset-bottom,0px)))] left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-[#151A1C]/90 backdrop-blur-md px-6 py-3.5 rounded-full border border-[#252C2E] shadow-2xl">
        {isIncoming ? (
          /* Incoming Call Accept / Decline Buttons */
          <div className="flex items-center gap-8">
            <button
              onClick={rejectCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition"
              title="Decline"
            >
              <PhoneOff size={24} />
            </button>
            <button
              onClick={acceptCall}
              className="w-14 h-14 rounded-full bg-brand hover:bg-brand-hover text-[#0B0F10] flex items-center justify-center shadow-lg active:scale-95 transition font-bold"
              title="Accept"
            >
              <Phone size={24} />
            </button>
          </div>
        ) : (
          /* Active Call Controls */
          <>
            <button
              onClick={toggleMute}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition shadow-md',
                activeCall.isMuted
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'bg-[#252C2E] text-[#F5F7F7] hover:bg-[#323B3E]'
              )}
              title={activeCall.isMuted ? 'Unmute' : 'Mute'}
            >
              {activeCall.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {isVideo && (
              <button
                onClick={toggleVideo}
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center transition shadow-md',
                  activeCall.isVideoOff
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-[#252C2E] text-[#F5F7F7] hover:bg-[#323B3E]'
                )}
                title={activeCall.isVideoOff ? 'Enable camera' : 'Disable camera'}
              >
                {activeCall.isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}

            {isVideo && !activeCall.isVideoOff && (
              <button
                onClick={flipCamera}
                className="w-12 h-12 rounded-full bg-[#252C2E] text-[#F5F7F7] hover:bg-[#323B3E] flex items-center justify-center transition shadow-md active:scale-95"
                title="Switch front/back camera"
              >
                <RotateCw size={19} />
              </button>
            )}

            <button
              onClick={endCall}
              className="w-13 h-13 w-[52px] h-[52px] rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition"
              title="End call"
            >
              <PhoneOff size={22} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
