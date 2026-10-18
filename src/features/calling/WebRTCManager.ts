import type { Profile } from '@/types/database.types';

export interface WebRTCCallbacks {
  onRemoteStream?: (stream: MediaStream) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private candidateQueue: RTCIceCandidateInit[] = [];
  private callbacks: WebRTCCallbacks = {};
  private fallbackCanvasInterval: ReturnType<typeof setInterval> | null = null;
  private remoteCanvasInterval: ReturnType<typeof setInterval> | null = null;
  private syntheticAudioCtx: AudioContext | null = null;
  private currentFacingMode: 'user' | 'environment' = 'user';

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  };

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public setExistingLocalStream(stream: MediaStream): void {
    this.localStream = stream;
  }

  public async startLocalMedia(isVideo: boolean): Promise<MediaStream | null> {
    // Release any prior tracks
    this.stopMedia();

    if (isVideo) {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          try {
            // Standard portrait-first mobile constraints
            this.localStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
              video: {
                facingMode: 'user',
              },
            });
          } catch {
            try {
              // Fallback to basic audio + video
              this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
              });
            } catch {
              // Fallback: request video stream and audio stream separately
              const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
              let aTracks: MediaStreamTrack[] = [];
              try {
                const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                aTracks = aStream.getAudioTracks();
              } catch {
                const s = this.createSyntheticAudioTrack();
                if (s) aTracks.push(s);
              }
              this.localStream = new MediaStream([...vStream.getVideoTracks(), ...aTracks]);
            }
          }
        } else {
          throw new Error('getUserMedia unavailable');
        }
      } catch (videoErr) {
        console.warn('Could not acquire hardware video stream:', videoErr);
        let audioTracks: MediaStreamTrack[] = [];
        try {
          if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioTracks = audioStream.getAudioTracks();
          }
        } catch {
          // ignore
        }

        const synthAudio = this.createSyntheticAudioTrack();
        if (synthAudio && audioTracks.length === 0) audioTracks.push(synthAudio);

        const fallbackVideo = this.createFallbackVideoTrack();
        const tracks: MediaStreamTrack[] = [...audioTracks];
        if (fallbackVideo) tracks.push(fallbackVideo);

        try {
          this.localStream = typeof MediaStream !== 'undefined' ? new MediaStream(tracks) : null;
        } catch {
          this.localStream = null;
        }
      }
    } else {
      // Audio only call
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
              video: false,
            });
          } catch {
            // Progressive fallback if advanced constraints rejected by mobile browser
            this.localStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
          }
        } else {
          throw new Error('getUserMedia unavailable');
        }
      } catch {
        const synthAudio = this.createSyntheticAudioTrack();
        try {
          this.localStream = synthAudio
            ? new MediaStream([synthAudio])
            : typeof MediaStream !== 'undefined'
            ? new MediaStream()
            : null;
        } catch {
          this.localStream = null;
        }
      }
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        t.enabled = true;
      });
    }

    if (this.callbacks.onLocalStream && this.localStream) {
      this.callbacks.onLocalStream(this.localStream);
    }
    return this.localStream;
  }

  public initializePeerConnection(): RTCPeerConnection | null {
    if (typeof RTCPeerConnection === 'undefined') return null;
    try {
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);
      this.remoteStream = null;

      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach((track) => {
          if (this.peerConnection && this.localStream) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }

      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
        } else if (event.track) {
          if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
          }
          if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
            this.remoteStream.addTrack(event.track);
          }
        }

        // Unmute and enable all incoming audio tracks
        if (this.remoteStream) {
          this.remoteStream.getAudioTracks().forEach((track) => {
            track.enabled = true;
          });
        }

        if (this.callbacks.onRemoteStream && this.remoteStream) {
          // Provide fresh MediaStream reference containing tracks so React hooks and callback refs re-bind immediately
          const streamToNotify = new MediaStream(this.remoteStream.getTracks());
          this.callbacks.onRemoteStream(streamToNotify);
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection && this.callbacks.onConnectionStateChange) {
          this.callbacks.onConnectionStateChange(this.peerConnection.connectionState);
        }
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.callbacks.onIceCandidate) {
          this.callbacks.onIceCandidate(event.candidate);
        }
      };

      return this.peerConnection;
    } catch {
      return null;
    }
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;
    const answer = await this.peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  public async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
    // Drain any queued candidates received before remote description
    while (this.candidateQueue.length > 0) {
      const cand = this.candidateQueue.shift();
      if (cand) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('Error applying queued ICE candidate:', e);
        }
      }
    }
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      this.candidateQueue.push(candidate);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('Error adding ICE candidate:', e);
    }
  }

  public async switchCamera(): Promise<MediaStream | null> {
    if (!this.localStream) return null;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return null;

    try {
      const targetFacing = this.currentFacingMode === 'environment' ? 'user' : 'environment';
      videoTrack.stop();

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: targetFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      this.currentFacingMode = targetFacing;

      // Replace track on local stream
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);

      // Replace track on peer connection if active
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      if (this.callbacks.onLocalStream) {
        this.callbacks.onLocalStream(this.localStream);
      }
      return this.localStream;
    } catch (e) {
      console.warn('Switch camera error:', e);
      return this.localStream;
    }
  }

  public hasRemoteTracks(): boolean {
    return Boolean(this.remoteStream && this.remoteStream.getTracks().length > 0);
  }

  public simulateRemoteStream(remoteUser?: Profile | null): MediaStream {
    if (typeof document === 'undefined') {
      this.remoteStream = typeof MediaStream !== 'undefined' ? new MediaStream() : (null as any);
      if (this.callbacks.onRemoteStream && this.remoteStream) {
        this.callbacks.onRemoteStream(this.remoteStream);
      }
      return this.remoteStream || ({} as any);
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      const avatarImg = new Image();
      avatarImg.crossOrigin = 'anonymous';
      if (remoteUser?.avatar_url) {
        avatarImg.src = remoteUser.avatar_url;
      }

      let frame = 0;
      const render = () => {
        if (!ctx) return;
        frame++;
        const grad = ctx.createLinearGradient(0, 0, 640, 480);
        grad.addColorStop(0, '#151A1C');
        grad.addColorStop(1, '#0B0F10');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, 480);

        // Ambient pulsing circle
        const pulse = Math.sin(frame * 0.05) * 8;
        ctx.beginPath();
        ctx.arc(320, 200, 80 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(165, 229, 72, 0.12)';
        ctx.fill();

        // Remote Avatar circle
        if (avatarImg.complete && avatarImg.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(320, 200, 72, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(avatarImg, 320 - 72, 200 - 72, 144, 144);
          ctx.restore();

          ctx.beginPath();
          ctx.arc(320, 200, 72, 0, Math.PI * 2);
          ctx.strokeStyle = '#A5E548';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(320, 200, 72, 0, Math.PI * 2);
          ctx.fillStyle = '#252C2E';
          ctx.fill();
          ctx.strokeStyle = '#A5E548';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = '#F5F7F7';
          ctx.font = 'bold 32px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            remoteUser?.display_name?.slice(0, 2).toUpperCase() || 'USER',
            320,
            212
          );
        }

        // Name & Live Status
        ctx.fillStyle = '#F5F7F7';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(remoteUser?.display_name || 'Remote User', 320, 320);

        ctx.fillStyle = '#A5E548';
        ctx.font = '14px sans-serif';
        ctx.fillText('• Live Feed', 320, 350);
      };

      render();
      if (this.remoteCanvasInterval) {
        clearInterval(this.remoteCanvasInterval);
      }
      this.remoteCanvasInterval = setInterval(render, 100);

      const stream = canvas.captureStream ? canvas.captureStream(15) : (canvas as any).mozCaptureStream(15);
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = this.createSyntheticAudioTrack();

      const tracks: MediaStreamTrack[] = [];
      if (videoTrack) tracks.push(videoTrack);
      if (audioTrack) tracks.push(audioTrack);

      this.remoteStream = new MediaStream(tracks);
      if (this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(this.remoteStream);
      }
      return this.remoteStream;
    } catch (e) {
      console.warn('Failed to simulate remote stream:', e);
      return this.remoteStream || new MediaStream();
    }
  }

  public simulateAudioStream(): MediaStream {
    const audioTrack = this.createSyntheticAudioTrack();
    const tracks: MediaStreamTrack[] = [];
    if (audioTrack) tracks.push(audioTrack);
    this.remoteStream = new MediaStream(tracks);
    if (this.callbacks.onRemoteStream) {
      this.callbacks.onRemoteStream(this.remoteStream);
    }
    return this.remoteStream;
  }

  private createSyntheticAudioTrack(): MediaStreamTrack | null {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      const audioCtx = new AudioCtx();
      this.syntheticAudioCtx = audioCtx;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      // Natural pleasant harmonic speech frequency
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      const dst = audioCtx.createMediaStreamDestination();
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      return dst.stream.getAudioTracks()[0] || null;
    } catch {
      return null;
    }
  }

  private createFallbackVideoTrack(): MediaStreamTrack | null {
    if (typeof document === 'undefined') return null;
    try {
      const canvas = document.createElement('canvas');
      if (!canvas || (!canvas.captureStream && !(canvas as any).mozCaptureStream)) {
        return null;
      }
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      let frame = 0;
      const render = () => {
        if (!ctx) return;
        frame++;
        const grad = ctx.createLinearGradient(0, 0, 640, 480);
        grad.addColorStop(0, '#151A1C');
        grad.addColorStop(1, '#0B0F10');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, 480);

        // Subtle pulse
        const pulse = Math.sin(frame * 0.05) * 8;
        ctx.beginPath();
        ctx.arc(320, 210, 80 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(165, 229, 72, 0.12)';
        ctx.fill();

        // Camera Circle
        ctx.beginPath();
        ctx.arc(320, 210, 70, 0, Math.PI * 2);
        ctx.fillStyle = '#252C2E';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#A5E548';
        ctx.stroke();

        // Stylized head & shoulders
        ctx.fillStyle = '#A5E548';
        ctx.beginPath();
        ctx.arc(320, 192, 26, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(320, 275, 42, Math.PI, 0, false);
        ctx.fill();

        // Label
        ctx.fillStyle = '#9BA5A8';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Live Camera Preview', 320, 340);
      };

      render();
      if (this.fallbackCanvasInterval) {
        clearInterval(this.fallbackCanvasInterval);
      }
      this.fallbackCanvasInterval = setInterval(render, 100);

      const stream = canvas.captureStream ? canvas.captureStream(15) : (canvas as any).mozCaptureStream(15);
      const track = stream?.getVideoTracks?.()[0] || null;
      if (track) {
        track.onended = () => {
          if (this.fallbackCanvasInterval) {
            clearInterval(this.fallbackCanvasInterval);
            this.fallbackCanvasInterval = null;
          }
        };
      }
      return track;
    } catch {
      return null;
    }
  }

  public toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // returns isMuted
    }
    return false;
  }

  public toggleVideo(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // returns isVideoOff
    }
    return false;
  }

  public stopMedia(stopLocalTracks = true): void {
    if (this.fallbackCanvasInterval) {
      clearInterval(this.fallbackCanvasInterval);
      this.fallbackCanvasInterval = null;
    }
    if (this.remoteCanvasInterval) {
      clearInterval(this.remoteCanvasInterval);
      this.remoteCanvasInterval = null;
    }

    if (this.syntheticAudioCtx) {
      try {
        this.syntheticAudioCtx.close();
      } catch {}
      this.syntheticAudioCtx = null;
    }

    if (stopLocalTracks && this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.remoteStream = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    this.candidateQueue = [];
  }
}
