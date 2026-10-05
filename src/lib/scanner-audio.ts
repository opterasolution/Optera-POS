/**
 * Pure Web Audio API Sound Synthesizer & Haptic Feedback for Mobile Barcode Scanners
 * 100% Offline, Zero external assets required.
 */

class ScannerAudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Crisp 1200Hz high chime for successful barcode match
   */
  public playSuccessBeep() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);

      // Mobile haptic vibration
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40]);
      }
    } catch (e) {
      console.warn("AudioContext play error:", e);
    }
  }

  /**
   * Dual 500Hz -> 400Hz alert for over-delivery or short-delivery warning
   */
  public playWarningBeep() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(550, ctx.currentTime);
      osc.frequency.setValueAtTime(420, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.16);

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([70, 40, 70]);
      }
    } catch (e) {
      console.warn("AudioContext play error:", e);
    }
  }

  /**
   * Low 220Hz buzz for unrecognized barcode or rejection
   */
  public playErrorBeep() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([180]);
      }
    } catch (e) {
      console.warn("AudioContext play error:", e);
    }
  }
}

export const scannerAudio = new ScannerAudioEngine();
