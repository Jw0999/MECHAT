import React, { useRef, useEffect, useCallback } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, RotateCw, Users } from 'lucide-react';
import { useCallStore, type GroupParticipant } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDuration, cn } from '@/lib/utils';

// Individual participant video tile component
const ParticipantTile: React.FC<{
  participant: GroupParticipant;
  isSelf: boolean;
  isVideoCall: boolean;
}> = ({ participant, isSelf, isVideoCall }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && participant.stream) {
        if (el.srcObject !== participant.stream) {
          el.srcObject = participant.stream;
        }
        el.play().catch(() => {});
      }
    },
    [participant.stream]
  );

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      if (videoRef.current.srcObject !== participant.stream) {
        videoRef.current.srcObject = participant.stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [participant.stream, participant.isVideoOff]);

  const hasVideo = isVideoCall && !participant.isVideoOff && Boolean(participant.stream);

  return (
    <div className="relative w-full h-full min-h-[140px] rounded-3xl overflow-hidden bg-[#151A1C] border border-[#252C2E] flex items-center justify-center shadow-lg group">
      {hasVideo ? (
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={cn(
            'w-full h-full object-cover',
            isSelf ? '-scale-x-100' : ''
          )}
        />
      ) : (
        /* Camera Off or Audio Call: Avatar with speaking wave */
        <div className="flex flex-col items-center justify-center p-4">
          <div className="relative">
            <div
              className={cn(
                'w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 transition-all duration-300',
                participant.isSpeaking
                  ? 'border-brand ring-4 ring-brand/30 animate-pulse scale-105'
                  : 'border-[#252C2E]'
              )}
            >
              {participant.user?.avatar_url ? (
                <img
                  src={participant.user.avatar_url}
                  alt={participant.user.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#252C2E] flex items-center justify-center text-brand font-bold text-xl sm:text-2xl">
                  {participant.user?.display_name?.slice(0, 2).toUpperCase() || 'U'}
                </div>
              )}
            </div>

            {/* Speaking indicator dot */}
            {participant.isSpeaking && (
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-brand rounded-full ring-2 ring-[#0B0F10] animate-ping" />
            )}
          </div>

          <p className="mt-3 text-xs sm:text-sm font-bold text-[#F5F7F7] truncate max-w-[150px]">
            {participant.user?.display_name || 'Member'}
          </p>
          <span className="text-[10px] text-[#9BA5A8]">
            {participant.isVideoOff ? 'Camera off' : 'Audio feed'}
          </span>
        </div>
      )}

      {/* Participant name and mic status pill at bottom-left */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-[#0B0F10]/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 z-10 max-w-[85%]">
        <span className="text-[11px] font-medium text-[#F5F7F7] truncate">
          {participant.user?.display_name || 'Member'} {isSelf ? '(You)' : ''}
        </span>
        <div className="shrink-0 text-[#9BA5A8]">
          {participant.isMuted ? (
            <MicOff size={12} className="text-red-400" />
          ) : (
            <Mic size={12} className="text-brand" />
          )}
        </div>
      </div>
    </div>
  );
};

export const GroupCallModal: React.FC = () => {
  const activeGroupCall = useCallStore((s) => s.activeGroupCall);
  const leaveGroupCall = useCallStore((s) => s.leaveGroupCall);
  const toggleGroupMute = useCallStore((s) => s.toggleGroupMute);
  const toggleGroupVideo = useCallStore((s) => s.toggleGroupVideo);
  const flipGroupCamera = useCallStore((s) => s.flipGroupCamera);
  const currentUserId = useAuthStore((s) => s.user?.id);

  if (!activeGroupCall) return null;

  const isVideo = activeGroupCall.callType === 'video';
  const participants = activeGroupCall.participants;
  const count = participants.length;

  // Grid layout class based on participant count
  let gridClass = 'grid-cols-1';
  if (count === 2) {
    gridClass = 'grid-cols-1 md:grid-cols-2';
  } else if (count >= 3 && count <= 4) {
    gridClass = 'grid-cols-2';
  } else if (count > 4) {
    gridClass = 'grid-cols-2 md:grid-cols-3';
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0B0F10] text-[#F5F7F7] select-none animate-fade-in">
      {/* Top Header Bar */}
      <header className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 flex items-center justify-between border-b border-[#252C2E]/60 bg-[#151A1C]/80 backdrop-blur-xl shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-brand/20 text-brand flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#F5F7F7] truncate max-w-[200px] sm:max-w-md">
              {activeGroupCall.groupTitle || 'Group Call'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#9BA5A8]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                {isVideo ? 'Group Video Call' : 'Group Voice Call'}
              </span>
              <span>•</span>
              <span className="font-mono text-brand font-semibold">
                {formatDuration(activeGroupCall.duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Member Count Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#252C2E] border border-white/5 text-xs font-semibold text-[#F5F7F7] shrink-0">
          <Users size={13} className="text-brand" />
          <span>{count} {count === 1 ? 'member' : 'members'}</span>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="flex-1 p-3 sm:p-4 overflow-y-auto">
        {count === 1 ? (
          /* Waiting for other participants */
          <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-[#151A1C] border-2 border-brand/40 flex items-center justify-center text-brand animate-pulse">
                <Users size={36} />
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand text-[#0B0F10] flex items-center justify-center font-bold text-xs ring-4 ring-[#0B0F10]">
                1
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F5F7F7]">Waiting for others to join...</h3>
              <p className="text-xs text-[#9BA5A8] mt-1 max-w-xs">
                Members of {activeGroupCall.groupTitle} will see this call in the group chat and can join anytime.
              </p>
            </div>
            {/* Self preview card */}
            <div className="w-full max-w-sm h-48 rounded-3xl overflow-hidden shadow-2xl">
              <ParticipantTile
                participant={participants[0]}
                isSelf={true}
                isVideoCall={isVideo}
              />
            </div>
          </div>
        ) : (
          /* Multi-Peer Video Grid */
          <div className={cn('grid gap-3 sm:gap-4 h-full auto-rows-fr', gridClass)}>
            {participants.map((participant) => (
              <ParticipantTile
                key={participant.id}
                participant={participant}
                isSelf={participant.id === currentUserId}
                isVideoCall={isVideo}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Controls Bar */}
      <footer className="px-6 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex items-center justify-center gap-4 bg-[#151A1C]/90 backdrop-blur-2xl border-t border-[#252C2E]/60 shrink-0 z-20">
        {/* Toggle Mic */}
        <button
          onClick={toggleGroupMute}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition shadow-md active:scale-95',
            activeGroupCall.isMuted
              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
              : 'bg-[#252C2E] text-[#F5F7F7] hover:bg-[#323B3E]'
          )}
          title={activeGroupCall.isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {activeGroupCall.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Toggle Camera (if video call) */}
        {isVideo && (
          <>
            <button
              onClick={toggleGroupVideo}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition shadow-md active:scale-95',
                activeGroupCall.isVideoOff
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'bg-[#252C2E] text-[#F5F7F7] hover:bg-[#323B3E]'
              )}
              title={activeGroupCall.isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {activeGroupCall.isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>

            {/* Flip Camera */}
            {!activeGroupCall.isVideoOff && (
              <button
                onClick={flipGroupCamera}
                className="w-12 h-12 rounded-full bg-[#252C2E] text-[#F5F7F7] hover:bg-[#323B3E] flex items-center justify-center transition shadow-md active:scale-95"
                title="Switch front/back camera"
              >
                <RotateCw size={19} />
              </button>
            )}
          </>
        )}

        {/* Leave Call */}
        <button
          onClick={leaveGroupCall}
          className="w-[52px] h-[52px] rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl active:scale-95 transition"
          title="Leave group call"
        >
          <PhoneOff size={22} />
        </button>
      </footer>
    </div>
  );
};
