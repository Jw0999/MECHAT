import React, { useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useCallStore } from '@/stores/callStore';
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

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Bind WebRTC media streams to video elements
  useEffect(() => {
    if (localVideoRef.current && activeCall?.localStream) {
      localVideoRef.current.srcObject = activeCall.localStream;
    }
  }, [activeCall?.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && activeCall?.remoteStream) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream;
    }
  }, [activeCall?.remoteStream]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in text-[#F5F7F7] select-none">
      {/* Video Call Stream View */}
      {isVideo && activeCall.status === 'connected' ? (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {/* Remote Video Stream (Full) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Local Camera (Picture-in-Picture) */}
          <div className="absolute top-6 right-6 w-32 sm:w-48 aspect-[3/4] bg-[#151A1C] rounded-2xl overflow-hidden border-2 border-brand/50 shadow-2xl z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
          </div>

          {/* Connected Call Header */}
          <div className="absolute top-8 left-6 z-10 flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
            <span className="text-sm font-bold">{remoteUser?.display_name}</span>
            <span className="text-xs font-mono text-[#9BA5A8]">
              {formatDuration(activeCall.duration)}
            </span>
          </div>
        </div>
      ) : (
        /* Audio Call View or Ringing / Calling View */
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
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-[#151A1C]/90 backdrop-blur-md px-6 py-3.5 rounded-full border border-[#252C2E] shadow-2xl">
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
