export interface WebRTCCallbacks {
  onRemoteStream?: (stream: MediaStream) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callbacks: WebRTCCallbacks = {};

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  public async startLocalMedia(isVideo: boolean): Promise<MediaStream> {
    try {
      // Release any prior tracks
      this.stopMedia();

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isVideo
          ? {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.callbacks.onLocalStream) {
        this.callbacks.onLocalStream(this.localStream);
      }
      return this.localStream;
    } catch (err: any) {
      console.warn('Could not access media devices, falling back to simulated stream:', err);
      // Create empty fallback stream to prevent crash in non-media environments
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const dst = audioCtx.createMediaStreamDestination();
      osc.connect(dst);
      osc.start();
      this.localStream = dst.stream;
      return this.localStream || new MediaStream();
    }
  }

  public initializePeerConnection(): RTCPeerConnection {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.remoteStream = new MediaStream();

    if (this.callbacks.onRemoteStream) {
      this.callbacks.onRemoteStream(this.remoteStream);
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
    }

    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream?.addTrack(track);
      });
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection && this.callbacks.onConnectionStateChange) {
        this.callbacks.onConnectionStateChange(this.peerConnection.connectionState);
      }
    };

    return this.peerConnection;
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

  public stopMedia(): void {
    if (this.localStream) {
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
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}
