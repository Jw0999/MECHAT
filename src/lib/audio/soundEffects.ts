// Web Audio API Ringtone & Audio Effects for MeChat
// Zero external file dependencies, guaranteed offline availability

class SoundEffectsManager {
  private audioCtx: AudioContext | null = null;
  private ringInterval: any = null;
  private activeNodes: Array<{ stop: () => void }> = [];

  private getContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play realistic melodious digital ringtone for incoming & outgoing calls
  public startRingtone() {
    this.stopRingtone();

    const playChimeBurst = () => {
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // Sequence of pleasant melodic frequencies (C5, E5, G5, B5)
        const notes = [523.25, 659.25, 783.99, 987.77];

        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0.001, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.12 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.38);

          this.activeNodes.push(osc);
        });
      } catch (err) {
        console.warn('AudioContext playback error:', err);
      }
    };

    // Play first burst immediately
    playChimeBurst();

    // Repeat every 2.4 seconds while ringing
    this.ringInterval = setInterval(playChimeBurst, 2400);
  }

  public stopRingtone() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }

    this.activeNodes.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Already stopped
      }
    });
    this.activeNodes = [];
  }

  // Subtle message sound
  public playMessageSound() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Audio autoplay restrictions
    }
  }
}

export const soundEffects = new SoundEffectsManager();
